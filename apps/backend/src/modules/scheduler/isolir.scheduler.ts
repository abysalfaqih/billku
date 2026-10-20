import { ConflictException, Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { bills, customers, packages, ipPools, mikrotikConfigs } from '../../database/schema';
import { RadiusService } from '../radius/radius.service';
import { MikrotikService, MikrotikUnreachableError } from '../mikrotik/mikrotik.service';
import type { MikrotikConnection } from '../mikrotik/mikrotik.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { TenantSubscriptionsService } from '../tenant-subscriptions/tenant-subscriptions.service';
import { BillingService } from '../billing/billing.service';
import { WhatsappTemplatesService } from '../whatsapp-templates/whatsapp-templates.service';
import { formatRupiah, formatTanggal } from '../whatsapp-templates/whatsapp-templates.defaults';

// Pengingat dikirim berapa hari sebelum jatuh tempo. Teks template bawaan
// ("dalam 3 hari") dan label "Pengingat Tagihan (H-3)" mengikuti angka ini.
export const REMINDER_DAYS_BEFORE_DUE = 3;

export interface IsolirFailure {
  customerId: number;
  name: string;
  username: string | null;
  reason: string;
}

export interface IsolirSummary {
  /** Pelanggan (aktif/isolir) yang punya tagihan lewat jatuh tempo */
  candidates: number;
  /** Baru berpindah active → isolated pada proses ini (WA isolir dikirim) */
  newlyIsolated: number;
  /** Sudah berstatus isolated; pemutusan jaringan dipastikan ulang */
  reconfirmed: number;
  /** Pemutusan gagal — status TIDAK diubah, dicoba lagi pada proses berikutnya */
  failed: IsolirFailure[];
}

interface IsolirCandidate {
  customerId: number;
  tenantId: string;
  name: string;
  phone: string;
  status: 'active' | 'isolated';
  connectionType: 'pppoe' | 'hotspot';
  username: string | null;
  customerMikrotikConfigId: number | null;
  // Router PPPoE: Paket → IP Pool → Mikrotik (null kalau rantai itu putus)
  router: MikrotikConnection | null;
  // Tagihan terlama yang menunggak — itu yang disebut di pesan WA
  oldestBill: { id: number; billNumber: string; amount: string };
}

@Injectable()
export class IsolirScheduler {
  private readonly logger = new Logger(IsolirScheduler.name);
  private running = false;

  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private radiusService: RadiusService,
    private mikrotikService: MikrotikService,
    private whatsappService: WhatsAppService,
    private tenantSubscriptionsService: TenantSubscriptionsService,
    private billingService: BillingService,
    private whatsappTemplatesService: WhatsappTemplatesService,
  ) {}

  @Cron('5 0 * * *')
  async handleDailyCheck() {
    if (this.running) {
      this.logger.warn('⏭️ Daily check sebelumnya masih berjalan — proses kali ini dilewati');
      return;
    }
    this.running = true;
    this.logger.log('⏰ Daily check dimulai...');
    try {
      // Tiap langkah berdiri sendiri: satu langkah gagal tidak boleh
      // membatalkan langkah sesudahnya (mis. isolir tetap jalan walau
      // pengecekan langganan mitra error).
      await this.runStep('Cek langganan mitra kedaluwarsa', () =>
        this.tenantSubscriptionsService.processExpiredSubscriptions(),
      );
      await this.runStep('Generate tagihan', () => this.processAutoGenerateBills());
      await this.runStep('Isolir otomatis', () => this.processAutoIsolir());
      await this.runStep('Pengingat tagihan', () => this.processReminderCheck());
    } finally {
      this.running = false;
    }
  }

  async runManually() {
    if (this.running) {
      throw new ConflictException('Proses harian sedang berjalan, coba lagi beberapa saat lagi');
    }
    this.running = true;
    this.logger.log('🔧 Manual trigger...');
    try {
      await this.processAutoGenerateBills();
      const isolir = await this.processAutoIsolir();
      const reminders = await this.processReminderCheck();
      return { isolir, reminders };
    } finally {
      this.running = false;
    }
  }

  private async runStep(label: string, fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`❌ ${label} gagal:`, err);
    }
  }

  // ─── Generate tagihan otomatis ─────────────────────────────────────────

  private async processAutoGenerateBills() {
    const today = new Date().getDate();

    const dueCustomers = await this.db
      .select({ id: customers.id, tenantId: customers.tenantId, name: customers.name })
      .from(customers)
      .where(and(eq(customers.status, 'active'), eq(customers.billingDate, today)));

    if (dueCustomers.length === 0) {
      this.logger.log('✅ Tidak ada pelanggan yang perlu di-generate tagihan hari ini');
      return;
    }

    let success = 0;
    for (const c of dueCustomers) {
      try {
        await this.billingService.generateForCustomer(c.id, c.tenantId);
        success++;
      } catch (err) {
        this.logger.warn(`⚠️ Skip generate '${c.name}': ${err}`);
      }
    }

    this.logger.log(`🧾 Auto-generate: ${success}/${dueCustomers.length} tagihan dibuat`);
  }

  // ─── Isolir otomatis ───────────────────────────────────────────────────

  /**
   * Urutan sengaja "jaringan dulu, baru catatan":
   *   1. Tagihan lewat jatuh tempo → 'overdue' (fakta tanggal, tidak bergantung router).
   *   2. Untuk tiap pelanggan yang menunggak: putus jaringan (RADIUS + Mikrotik).
   *   3. HANYA kalau pemutusan berhasil: status pelanggan → 'isolated', lalu WA.
   *
   * Dulu status diubah lebih dulu lalu jaringan dicoba "sekalian"; kalau router
   * sedang mati, pelanggan tercatat isolir padahal internetnya masih jalan, WA
   * tetap terkirim, dan tidak pernah dicoba lagi (query hanya memilih tagihan
   * 'unpaid'). Sekarang pemutusan yang gagal membuat pelanggan tetap 'active'
   * dan otomatis dicoba lagi malam berikutnya.
   *
   * Pelanggan yang sudah 'isolated' tapi masih punya tunggakan ikut diproses
   * ulang (idempotent) — ini sekaligus memperbaiki data lama yang "tercatat
   * isolir tapi internet masih jalan". WA isolir hanya dikirim saat pelanggan
   * benar-benar berpindah dari 'active' ke 'isolated', jadi tidak berulang
   * tiap malam. 'suspended' dan 'terminated' dilewati: itu keputusan manual.
   *
   * Catatan skala: pelanggan isolir lama yang tak kunjung bayar ikut dicek tiap
   * malam (satu koneksi router per pelanggan). Kalau jumlahnya sudah ratusan,
   * pertimbangkan mengelompokkan per router atau menghentikan pelanggan yang
   * sudah terlalu lama menunggak (status 'terminated').
   */
  async processAutoIsolir(): Promise<IsolirSummary> {
    await this.db
      .update(bills)
      .set({ status: 'overdue', updatedAt: new Date() })
      .where(and(eq(bills.status, 'unpaid'), sql`${bills.dueDate} < CURDATE()`));

    const candidates = await this.loadIsolirCandidates();
    const summary: IsolirSummary = {
      candidates: candidates.length,
      newlyIsolated: 0,
      reconfirmed: 0,
      failed: [],
    };

    if (candidates.length === 0) {
      this.logger.log('✅ Tidak ada pelanggan yang perlu diisolir');
      return summary;
    }

    const hotspotConfigs = await this.loadHotspotConfigs(candidates);
    // Router yang sudah terbukti tidak terjangkau pada proses ini — pelanggan
    // lain di router yang sama langsung dilewati, bukan menunggu timeout lagi.
    const deadRouters = new Map<string, string>();

    for (const c of candidates) {
      try {
        await this.cutNetwork(c, hotspotConfigs, deadRouters);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        summary.failed.push({ customerId: c.customerId, name: c.name, username: c.username, reason });
        this.logger.error(`❌ Isolir '${c.username ?? c.name}' gagal (status tetap '${c.status}', dicoba lagi besok): ${reason}`);
        continue;
      }

      if (c.status !== 'active') {
        summary.reconfirmed++;
        continue;
      }

      try {
        const [res] = await this.db
          .update(customers)
          .set({ status: 'isolated', updatedAt: new Date() })
          .where(and(eq(customers.id, c.customerId), eq(customers.status, 'active')));
        // Status sudah diubah pihak lain di sela-sela (mis. dibayar/ditangguhkan
        // admin) → jangan kirim WA isolir.
        if (!res || res.affectedRows < 1) continue;
      } catch (err) {
        const reason = `jaringan sudah diputus tetapi status gagal disimpan: ${err instanceof Error ? err.message : String(err)}`;
        summary.failed.push({ customerId: c.customerId, name: c.name, username: c.username, reason });
        this.logger.error(`❌ Isolir '${c.username ?? c.name}': ${reason}`);
        continue;
      }

      summary.newlyIsolated++;
      await this.notifyIsolir(c);
    }

    this.logger.log(
      `🔴 Isolir: ${summary.newlyIsolated} pelanggan baru diisolir, ${summary.reconfirmed} dipastikan ulang, ` +
      `${summary.failed.length} GAGAL dari ${summary.candidates} pelanggan menunggak`,
    );
    if (summary.failed.length > 0) {
      this.logger.warn(
        `⚠️ ${summary.failed.length} pelanggan belum berhasil diputus jaringannya dan akan dicoba lagi malam berikutnya: ` +
        summary.failed.map((f) => `${f.username ?? f.name} (${f.reason})`).join(' | '),
      );
    }

    return summary;
  }

  /** Satu query: semua tagihan menunggak + pelanggan + router PPPoE-nya. */
  private async loadIsolirCandidates(): Promise<IsolirCandidate[]> {
    const rows = await this.db
      .select({
        billId: bills.id,
        billNumber: bills.billNumber,
        billAmount: bills.totalAmount,
        customerId: customers.id,
        tenantId: customers.tenantId,
        name: customers.name,
        phone: customers.phone,
        status: customers.status,
        connectionType: customers.connectionType,
        username: customers.usernamePppoe,
        customerMikrotikConfigId: customers.mikrotikConfigId,
        mikrotikHost: mikrotikConfigs.host,
        mikrotikPort: mikrotikConfigs.port,
        mikrotikUsername: mikrotikConfigs.username,
        mikrotikPassword: mikrotikConfigs.password,
      })
      .from(bills)
      .innerJoin(customers, and(eq(bills.customerId, customers.id), eq(customers.tenantId, bills.tenantId)))
      .leftJoin(packages, eq(customers.packageId, packages.id))
      .leftJoin(ipPools, eq(packages.ipPoolId, ipPools.id))
      // Router harus milik tenant yang sama dengan pelanggan.
      .leftJoin(
        mikrotikConfigs,
        and(eq(ipPools.mikrotikConfigId, mikrotikConfigs.id), eq(mikrotikConfigs.tenantId, bills.tenantId)),
      )
      .where(
        and(
          inArray(bills.status, ['unpaid', 'overdue']),
          sql`${bills.dueDate} < CURDATE()`,
          inArray(customers.status, ['active', 'isolated']),
        ),
      )
      .orderBy(asc(bills.dueDate), asc(bills.id));

    // Diurutkan dari tagihan terlama, jadi baris pertama tiap pelanggan = yang terlama.
    const byCustomer = new Map<number, IsolirCandidate>();
    for (const r of rows) {
      if (byCustomer.has(r.customerId)) continue;
      byCustomer.set(r.customerId, {
        customerId: r.customerId,
        tenantId: r.tenantId,
        name: r.name,
        phone: r.phone,
        status: r.status as 'active' | 'isolated',
        connectionType: r.connectionType,
        username: r.username,
        customerMikrotikConfigId: r.customerMikrotikConfigId,
        router: r.mikrotikHost
          ? {
              host: r.mikrotikHost,
              port: r.mikrotikPort ?? 8728,
              username: r.mikrotikUsername ?? '',
              password: r.mikrotikPassword ?? '',
            }
          : null,
        oldestBill: { id: r.billId, billNumber: r.billNumber, amount: r.billAmount },
      });
    }
    return [...byCustomer.values()];
  }

  /** Router pelanggan hotspot dipilih langsung di pelanggan, bukan lewat paket. */
  private async loadHotspotConfigs(candidates: IsolirCandidate[]) {
    const ids = [
      ...new Set(
        candidates
          .filter((c) => c.connectionType === 'hotspot' && c.customerMikrotikConfigId)
          .map((c) => c.customerMikrotikConfigId as number),
      ),
    ];
    const map = new Map<number, typeof mikrotikConfigs.$inferSelect>();
    if (ids.length === 0) return map;
    const rows = await this.db.select().from(mikrotikConfigs).where(inArray(mikrotikConfigs.id, ids));
    for (const row of rows) map.set(row.id, row);
    return map;
  }

  /**
   * Putus jaringan satu pelanggan. THROW kalau belum terputus dengan pasti —
   * pemanggil lalu membiarkan status pelanggan apa adanya.
   */
  private async cutNetwork(
    c: IsolirCandidate,
    hotspotConfigs: Map<number, typeof mikrotikConfigs.$inferSelect>,
    deadRouters: Map<string, string>,
  ): Promise<void> {
    // Belum punya akun jaringan → tidak ada yang bisa diputus.
    if (!c.username) return;

    if (c.connectionType === 'hotspot') {
      const cfg = c.customerMikrotikConfigId ? hotspotConfigs.get(c.customerMikrotikConfigId) : undefined;
      // Jangan sentuh router tenant lain.
      if (!cfg || cfg.tenantId !== c.tenantId) {
        throw new Error('Mikrotik pelanggan hotspot tidak ditemukan (cek pengaturan Mikrotik pada data pelanggan)');
      }
      await this.onRouter(cfg, deadRouters, (conn) =>
        this.mikrotikService.disableHotspotUserStrict(conn, c.username as string),
      );
      return;
    }

    // PPPoE: blokir di RADIUS dulu (supaya tidak bisa tersambung lagi), baru
    // putus sesi yang sedang aktif. Kalau RADIUS gagal, sesi TIDAK diputus —
    // pelanggan akan langsung tersambung lagi dan yang didapat hanya gangguan.
    try {
      await this.radiusService.disableUser(c.username);
    } catch (err) {
      throw new Error(`RADIUS gagal diperbarui: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!c.router) {
      // Penyebab paling umum "sudah isolir tapi internet masih nyala".
      throw new Error(
        'Mikrotik tidak ditemukan (cek Paket → IP Pool → Mikrotik) — akun RADIUS sudah diblokir, ' +
        'tetapi sesi yang sedang aktif belum bisa diputus',
      );
    }
    await this.onRouter(c.router, deadRouters, (conn) =>
      this.mikrotikService.kickSessionStrict(conn, c.username as string),
    );
  }

  private async onRouter(
    conn: MikrotikConnection,
    deadRouters: Map<string, string>,
    action: (conn: MikrotikConnection) => Promise<unknown>,
  ): Promise<void> {
    const key = `${conn.host}:${conn.port}`;
    const dead = deadRouters.get(key);
    if (dead) throw new Error(`${dead} (dilewati: router ini sudah gagal dihubungi pada proses ini)`);
    try {
      await action(conn);
    } catch (err) {
      if (err instanceof MikrotikUnreachableError) deadRouters.set(key, err.message);
      throw err;
    }
  }

  private async notifyIsolir(c: IsolirCandidate) {
    if (!c.username || !c.phone) return;
    try {
      await this.whatsappService.queueNotification({
        tenantId: c.tenantId,
        phone: c.phone,
        message: await this.whatsappTemplatesService.render('isolir', c.tenantId, {
          name: c.name,
          billNumber: c.oldestBill.billNumber,
          amount: formatRupiah(c.oldestBill.amount),
        }),
        trigger: 'isolir',
        customerId: c.customerId,
        billId: c.oldestBill.id,
      });
    } catch (err) {
      // Jaringan sudah terputus dan status sudah tersimpan; gagal menyusun/
      // mengantre WA tidak boleh menghentikan pelanggan berikutnya.
      this.logger.error(`❌ WA isolir '${c.username}' gagal diantrekan: ${err}`);
    }
  }

  // ─── Pengingat tagihan ─────────────────────────────────────────────────

  async processReminderCheck(): Promise<number> {
    const reminderBills = await this.db
      .select({
        id: bills.id,
        tenantId: bills.tenantId,
        customerId: bills.customerId,
        billNumber: bills.billNumber,
        amount: bills.totalAmount,
        // String 'YYYY-MM-DD' langsung dari MySQL — kolom `date` yang dibaca
        // sebagai objek Date bisa bergeser sehari mengikuti zona waktu server.
        dueDate: sql<string>`DATE_FORMAT(${bills.dueDate}, '%Y-%m-%d')`,
        name: customers.name,
        phone: customers.phone,
      })
      .from(bills)
      .innerJoin(customers, and(eq(bills.customerId, customers.id), eq(customers.tenantId, bills.tenantId)))
      .where(
        and(
          sql`${bills.dueDate} = DATE_ADD(CURDATE(), INTERVAL ${sql.raw(String(REMINDER_DAYS_BEFORE_DUE))} DAY)`,
          eq(bills.status, 'unpaid'),
          // Pelanggan yang sedang isolir/ditangguhkan/berhenti tidak diberi
          // pengingat "bayar supaya tidak diputus".
          eq(customers.status, 'active'),
        ),
      );

    if (reminderBills.length === 0) return 0;

    this.logger.log(`📢 Pengingat H-${REMINDER_DAYS_BEFORE_DUE}: ${reminderBills.length} pelanggan akan dinotifikasi`);

    let queued = 0;
    for (const item of reminderBills) {
      if (!item.phone) continue;
      try {
        await this.whatsappService.queueNotification({
          tenantId: item.tenantId,
          phone: item.phone,
          message: await this.whatsappTemplatesService.render('reminder', item.tenantId, {
            name: item.name,
            billNumber: item.billNumber,
            amount: formatRupiah(item.amount),
            dueDate: formatTanggal(item.dueDate),
          }),
          trigger: 'reminder',
          customerId: item.customerId,
          billId: item.id,
        });
        queued++;
      } catch (err) {
        this.logger.error(`❌ Pengingat tagihan #${item.id} gagal diantrekan: ${err}`);
      }
    }
    return queued;
  }
}
