import { ConflictException, Injectable, Logger, Inject } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { bills, customers, packages, ipPools, mikrotikConfigs, whatsappLogs } from '../../database/schema';
import { RadiusService } from '../radius/radius.service';
import { MikrotikService, MikrotikUnreachableError } from '../mikrotik/mikrotik.service';
import type { MikrotikConnection } from '../mikrotik/mikrotik.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { TenantSubscriptionsService } from '../tenant-subscriptions/tenant-subscriptions.service';
import { BillingService } from '../billing/billing.service';
import { WhatsappTemplatesService } from '../whatsapp-templates/whatsapp-templates.service';
import { formatRupiah, formatTanggal, sisaWaktuText } from '../whatsapp-templates/whatsapp-templates.defaults';
import { readNonNegativeInt } from '../../common/utils/config-int.util';
import { APP_TIMEZONE, todayInAppTz, ymdInAppTz } from '../../common/utils/app-time.util';
import {
  DEFAULT_BILL_LEAD_DAYS,
  MAX_BILL_LEAD_DAYS,
  addDays,
  parseYmd,
  periodStartInWindow,
  toYmd,
} from '../billing/billing-period.util';

// Pengingat dikirim berapa hari sebelum jatuh tempo. Teks template bawaan
// ("dalam 3 hari") dan label "Pengingat Tagihan (H-3)" mengikuti angka ini.
export const REMINDER_DAYS_BEFORE_DUE = 3;

// Proses harian yang masih "berjalan" lebih lama dari ini dianggap macet (mis.
// menunggu koneksi yang tak pernah putus) dan tidak lagi menghalangi proses
// berikutnya. Semua langkah bersifat idempotent, jadi dua proses yang kebetulan
// tumpang-tindih tidak merusak data.
export const STALE_RUN_MS = 2 * 60 * 60 * 1000;

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
export class IsolirScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(IsolirScheduler.name);
  private running = false;
  private runningSince = 0;

  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private radiusService: RadiusService,
    private mikrotikService: MikrotikService,
    private whatsappService: WhatsAppService,
    private tenantSubscriptionsService: TenantSubscriptionsService,
    private billingService: BillingService,
    private whatsappTemplatesService: WhatsappTemplatesService,
    private config: ConfigService,
  ) {}

  /**
   * Catat selisih zona waktu saat aplikasi menyala. Tanggal untuk tagihan, isolir
   * dan pengingat dihitung aplikasi (WIB) lalu dikirim ke SQL, jadi zona waktu
   * database tidak memengaruhi jadwal; baris ini hanya untuk diagnosa — halaman
   * yang masih memakai CURDATE() database (dashboard, laporan) bisa bergeser sehari
   * pada jam-jam tertentu kalau zona waktunya berbeda.
   */
  async onApplicationBootstrap() {
    try {
      const [rows] = (await this.db.execute(
        sql`SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW()) AS offsetMin, @@session.time_zone AS tz`,
      )) as unknown as [{ offsetMin: number | string; tz: string }[]];
      const dbOffsetMin = Number(rows?.[0]?.offsetMin);
      const appOffsetMin = 7 * 60; // WIB
      if (Number.isFinite(dbOffsetMin) && dbOffsetMin !== appOffsetMin) {
        this.logger.warn(
          `🕐 Zona waktu database (UTC${dbOffsetMin >= 0 ? '+' : ''}${dbOffsetMin / 60}, ${rows?.[0]?.tz}) berbeda dari ${APP_TIMEZONE}. ` +
            'Jadwal tagihan/isolir/pengingat aman (tanggal dihitung aplikasi), tetapi dashboard & laporan yang memakai tanggal database bisa bergeser sehari di jam tertentu.',
        );
      } else {
        this.logger.log(`🕐 Zona waktu: aplikasi & database sama (${APP_TIMEZONE}); hari ini ${ymdInAppTz()}`);
      }
    } catch (err) {
      this.logger.warn(`Tidak bisa memeriksa zona waktu database: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Proses utama: tiap hari 00:05 WIB.
  @Cron('5 0 * * *', { name: 'daily-check', timeZone: APP_TIMEZONE })
  async handleDailyCheck() {
    await this.runPass('Daily check', { full: true });
  }

  /**
   * Proses susulan 03:05 dan 06:05 WIB. Semua langkahnya idempotent, jadi hanya
   * mengerjakan yang LUPUT pada proses utama: router/RADIUS yang tadi tidak
   * terjangkau (pelanggan baru diisolir begitu pulih, tidak menunggu tengah
   * malam berikutnya), server yang sedang restart pukul 00:05, pengingat/tagihan
   * yang terlewat. Pelanggan yang sudah isolir tidak dicek ulang di sini.
   */
  @Cron('5 3,6 * * *', { name: 'daily-check-catchup', timeZone: APP_TIMEZONE })
  async handleCatchUp() {
    await this.runPass('Proses susulan', { full: false });
  }

  private isBusy(): boolean {
    if (!this.running) return false;
    if (Date.now() - this.runningSince > STALE_RUN_MS) {
      this.logger.error(
        `⚠️ Proses harian sebelumnya sudah berjalan lebih dari ${STALE_RUN_MS / 3_600_000} jam tanpa selesai — dianggap macet dan tidak lagi menghalangi proses baru`,
      );
      return false;
    }
    return true;
  }

  private async runPass(label: string, opts: { full: boolean }) {
    if (this.isBusy()) {
      this.logger.warn(`⏭️ ${label}: proses sebelumnya masih berjalan — dilewati`);
      return;
    }
    this.running = true;
    this.runningSince = Date.now();
    this.logger.log(`⏰ ${label} dimulai (tanggal acuan ${ymdInAppTz()} ${APP_TIMEZONE})...`);
    try {
      // Tiap langkah berdiri sendiri: satu langkah gagal tidak boleh
      // membatalkan langkah sesudahnya (mis. isolir tetap jalan walau
      // pengecekan langganan mitra error).
      if (opts.full) {
        await this.runStep('Cek langganan mitra kedaluwarsa', () =>
          this.tenantSubscriptionsService.processExpiredSubscriptions(),
        );
      }
      await this.runStep('Generate tagihan', () => this.processAutoGenerateBills());
      await this.runStep('Isolir otomatis', () => this.processAutoIsolir({ reconfirm: opts.full }));
      await this.runStep('Pengingat tagihan', () => this.processReminderCheck());
    } finally {
      this.running = false;
    }
  }

  async runManually() {
    if (this.isBusy()) {
      throw new ConflictException('Proses harian sedang berjalan, coba lagi beberapa saat lagi');
    }
    this.running = true;
    this.runningSince = Date.now();
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

  /**
   * Tagihan terbit BILL_LEAD_DAYS hari (bawaan 7) sebelum tanggal tagihan; jatuh
   * tempo tetap di tanggal tagihan. Dengan begitu pelanggan yang membayar lebih
   * awal punya tagihan untuk dilunasi, dan pengingat H-3 punya tagihan untuk
   * diingatkan.
   *
   * Memakai JENDELA, bukan "tepat hari H": tiap malam diterbitkan semua tagihan
   * yang periodenya mulai dalam [hari ini, hari ini + N] dan belum ada. Server
   * yang mati pada malam tertentu tidak membuat tagihan hilang — terbit di malam
   * berikutnya. Periode yang sudah ada (termasuk yang dibayar di muka) dilewati
   * diam-diam lewat satu query, bukan lewat error per pelanggan.
   * BILL_LEAD_DAYS=0 = perilaku lama (terbit tepat di tanggal tagihan).
   */
  private async processAutoGenerateBills() {
    const leadDays = readNonNegativeInt(
      this.config,
      'BILL_LEAD_DAYS',
      DEFAULT_BILL_LEAD_DAYS,
      this.logger,
      MAX_BILL_LEAD_DAYS,
    );
    const today = todayInAppTz();
    const todayYmd = toYmd(today);

    const activeCustomers = await this.db
      .select({
        id: customers.id,
        tenantId: customers.tenantId,
        name: customers.name,
        billingDate: customers.billingDate,
      })
      .from(customers)
      .where(eq(customers.status, 'active'));

    const inWindow: { id: number; tenantId: string; name: string; start: Date }[] = [];
    for (const c of activeCustomers) {
      const start = periodStartInWindow(c.billingDate, today, leadDays);
      if (start) inWindow.push({ id: c.id, tenantId: c.tenantId, name: c.name, start });
    }

    if (inWindow.length === 0) {
      this.logger.log('✅ Tidak ada pelanggan yang perlu di-generate tagihan hari ini');
      return;
    }

    const starts = inWindow.map((c) => toYmd(c.start)).sort();
    const firstStart = starts[0];
    const lastStart = starts[starts.length - 1];
    const ymd = (col: typeof bills.periodStart | typeof bills.periodEnd) =>
      sql<string>`DATE_FORMAT(${col}, '%Y-%m-%d')`;

    // 1) Periode yang sudah TERCAKUP tagihan (bukan hanya yang awal periodenya sama
    //    persis): mis. pelanggan yang tanggal tagihannya diubah admin tepat setelah
    //    membayar tidak ditagih lagi untuk hari-hari yang sudah ia bayar.
    const coverRows = await this.db
      .select({
        customerId: bills.customerId,
        periodStart: ymd(bills.periodStart),
        periodEnd: ymd(bills.periodEnd),
      })
      .from(bills)
      .where(
        and(
          ne(bills.status, 'cancelled'),
          sql`${bills.periodStart} <= ${lastStart}`,
          sql`${bills.periodEnd} >= ${firstStart}`,
        ),
      );
    const coverByCustomer = new Map<number, { periodStart: string; periodEnd: string }[]>();
    for (const r of coverRows) {
      const list = coverByCustomer.get(r.customerId) ?? [];
      list.push(r);
      coverByCustomer.set(r.customerId, list);
    }
    const isCovered = (c: { id: number; start: Date }) => {
      const s = toYmd(c.start);
      return (coverByCustomer.get(c.id) ?? []).some((r) => r.periodStart <= s && r.periodEnd >= s);
    };

    // 2) Pelanggan yang masih punya tagihan lewat jatuh tempo TIDAK ditagih lagi:
    //    yang berhenti/terisolir hanya berutang satu tagihan itu sampai ia melunasinya.
    const arrearsRows = await this.db
      .select({ customerId: bills.customerId })
      .from(bills)
      .where(
        and(
          inArray(bills.customerId, inWindow.map((c) => c.id)),
          inArray(bills.status, ['unpaid', 'overdue']),
          sql`${bills.dueDate} < ${todayYmd}`,
        ),
      );
    const inArrears = new Set(arrearsRows.map((r) => r.customerId));

    const pending = inWindow.filter((c) => !isCovered(c));
    const held = pending.filter((c) => inArrears.has(c.id));
    const todo = pending.filter((c) => !inArrears.has(c.id));

    if (held.length > 0) {
      this.logger.log(`⏸️ ${held.length} pelanggan tidak ditagih periode baru karena masih menunggak: ${held.map((c) => c.name).join(', ')}`);
    }
    if (todo.length === 0) {
      this.logger.log(`✅ Tidak ada tagihan baru yang perlu terbit (${inWindow.length} pelanggan dalam jendela ${leadDays} hari)`);
      return;
    }

    let success = 0;
    for (const c of todo) {
      try {
        await this.billingService.generateForCustomer(c.id, c.tenantId, c.start);
        success++;
      } catch (err) {
        this.logger.warn(`⚠️ Skip generate '${c.name}': ${err}`);
      }
    }

    this.logger.log(`🧾 Auto-generate: ${success}/${todo.length} tagihan dibuat (terbit ${leadDays} hari sebelum tanggal tagihan)`);
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
  async processAutoIsolir(opts: { reconfirm?: boolean } = {}): Promise<IsolirSummary> {
    // "Hari ini" dihitung aplikasi (WIB) dan dikirim sebagai parameter — bukan CURDATE()
    // database yang bisa berzona waktu lain.
    const todayYmd = ymdInAppTz();
    await this.db
      .update(bills)
      .set({ status: 'overdue', updatedAt: new Date() })
      .where(and(eq(bills.status, 'unpaid'), sql`${bills.dueDate} < ${todayYmd}`));

    // Proses susulan (reconfirm=false) hanya menangani pelanggan yang masih 'active'
    // — yang tadi gagal diputus atau baru jatuh tempo — tanpa mengulang pengecekan
    // router untuk ratusan pelanggan yang sudah isolir.
    const all = await this.loadIsolirCandidates(todayYmd);
    const candidates = opts.reconfirm === false ? all.filter((c) => c.status === 'active') : all;
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
  private async loadIsolirCandidates(todayYmd: string): Promise<IsolirCandidate[]> {
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
          sql`${bills.dueDate} < ${todayYmd}`,
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

  /**
   * Satu pengingat per tagihan, dikirim pada proses pertama setelah jatuh temponya
   * masuk dalam REMINDER_DAYS_BEFORE_DUE hari ke depan (dan belum terlewat).
   *
   * Memakai JENDELA [hari ini, hari ini + 3], bukan "tepat 3 hari lagi" seperti dulu:
   * pencocokan harian-persis membuat satu proses yang terlewat (server restart,
   * router/WA gangguan, zona waktu bergeser) = pengingat tagihan itu hilang untuk
   * selamanya, dan tagihan yang baru terbit H-2 tidak pernah diingatkan. Pengingat
   * yang sudah terkirim dikenali dari log WA ('sent'), jadi proses susulan tidak
   * mengirim dobel.
   */
  async processReminderCheck(): Promise<number> {
    const today = todayInAppTz();
    const todayYmd = toYmd(today);
    const horizonYmd = toYmd(addDays(today, REMINDER_DAYS_BEFORE_DUE));

    const dueSoon = await this.db
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
          sql`${bills.dueDate} >= ${todayYmd}`,
          sql`${bills.dueDate} <= ${horizonYmd}`,
          eq(bills.status, 'unpaid'),
          // Pelanggan yang sedang isolir/ditangguhkan/berhenti tidak diberi
          // pengingat "bayar supaya tidak diputus".
          eq(customers.status, 'active'),
        ),
      )
      .orderBy(asc(bills.dueDate), asc(bills.id));

    if (dueSoon.length === 0) return 0;

    const sentRows = await this.db
      .select({ billId: whatsappLogs.billId })
      .from(whatsappLogs)
      .where(
        and(
          eq(whatsappLogs.trigger, 'reminder'),
          eq(whatsappLogs.status, 'sent'),
          inArray(whatsappLogs.billId, dueSoon.map((b) => b.id)),
        ),
      );
    const alreadySent = new Set(sentRows.map((r) => r.billId));
    const reminderBills = dueSoon.filter((b) => !alreadySent.has(b.id));

    if (reminderBills.length === 0) return 0;

    this.logger.log(`📢 Pengingat tagihan: ${reminderBills.length} pelanggan akan dinotifikasi`);

    let queued = 0;
    for (const item of reminderBills) {
      if (!item.phone) continue;
      try {
        const daysLeft = Math.round((parseYmd(item.dueDate).getTime() - today.getTime()) / 86_400_000);
        const ok = await this.whatsappService.queueNotification(
          {
            tenantId: item.tenantId,
            phone: item.phone,
            message: await this.whatsappTemplatesService.render('reminder', item.tenantId, {
              name: item.name,
              billNumber: item.billNumber,
              amount: formatRupiah(item.amount),
              dueDate: formatTanggal(item.dueDate),
              sisaWaktu: sisaWaktuText(daysLeft),
            }),
            trigger: 'reminder',
            customerId: item.customerId,
            billId: item.id,
          },
          // Satu rantai pengiriman per tagihan per hari, walau proses dijalankan berkali-kali.
          // Pesan yang masih berjalan/menunggu percobaan ulang atau sudah sukses tidak
          // diantre lagi; yang GAGAL FINAL dilepas (lihat WhatsAppService) sehingga proses
          // susulan 03:05/06:05 benar-benar mencoba ulang.
          { jobId: `reminder-${item.id}-${todayYmd}` },
        );
        if (ok) queued++;
      } catch (err) {
        this.logger.error(`❌ Pengingat tagihan #${item.id} gagal diantrekan: ${err}`);
      }
    }
    return queued;
  }
}
