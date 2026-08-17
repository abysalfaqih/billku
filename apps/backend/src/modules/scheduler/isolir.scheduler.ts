import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { bills, customers, packages, ipPools, mikrotikConfigs } from '../../database/schema';
import { RadiusService } from '../radius/radius.service';
import { MikrotikService } from '../mikrotik/mikrotik.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { TenantSubscriptionsService } from '../tenant-subscriptions/tenant-subscriptions.service';
import { BillingService } from '../billing/billing.service';
import { WhatsappTemplatesService } from '../whatsapp-templates/whatsapp-templates.service';
import { formatRupiah } from '../whatsapp-templates/whatsapp-templates.defaults';

@Injectable()
export class IsolirScheduler {
  private readonly logger = new Logger(IsolirScheduler.name);

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
    this.logger.log('⏰ Daily check dimulai...');
    try {
      await this.tenantSubscriptionsService.processExpiredSubscriptions();
      await this.processAutoGenerateBills();
      await this.processAutoIsolir();
      await this.processReminderCheck();
    } catch (err) {
      this.logger.error('❌ Daily check gagal:', err);
    }
  }

  async runManually() {
    this.logger.log('🔧 Manual trigger...');
    await this.processAutoGenerateBills();
    await this.processAutoIsolir();
    await this.processReminderCheck();
  }

  // ─── BARU: Generate tagihan otomatis ───────────────────────────────────
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

  private async processAutoIsolir() {
    const overdueBills = await this.db
      .select({
        billId: bills.id,
        customerId: bills.customerId,
        tenantId: bills.tenantId,
        usernamePppoe: customers.usernamePppoe,
        mikrotikHost: mikrotikConfigs.host,
        mikrotikPort: mikrotikConfigs.port,
        mikrotikUsername: mikrotikConfigs.username,
        mikrotikPassword: mikrotikConfigs.password,
      })
      .from(bills)
      .leftJoin(customers, eq(bills.customerId, customers.id))
      .leftJoin(packages, eq(customers.packageId, packages.id))
      .leftJoin(ipPools, eq(packages.ipPoolId, ipPools.id))
      .leftJoin(mikrotikConfigs, eq(ipPools.mikrotikConfigId, mikrotikConfigs.id))
      .where(
        and(
          sql`DATE(${bills.dueDate}) < CURDATE()`,
          eq(bills.status, 'unpaid'),
        ),
      );

    if (overdueBills.length === 0) {
      this.logger.log('✅ Tidak ada tagihan yang perlu diisolir');
      return;
    }

    const billIds = overdueBills.map(b => b.billId);
    const customerIds = [...new Set(overdueBills.map(b => b.customerId))];

    await this.db
      .update(bills)
      .set({ status: 'overdue', updatedAt: new Date() })
      .where(inArray(bills.id, billIds));

    await this.db
      .update(customers)
      .set({ status: 'isolated', updatedAt: new Date() })
      .where(and(inArray(customers.id, customerIds), eq(customers.status, 'active')));

    this.logger.log(
      `🔴 DB: ${overdueBills.length} tagihan overdue, ${customerIds.length} pelanggan diisolir`,
    );

    for (const item of overdueBills) {
      if (!item.usernamePppoe) continue;

      // Cek tipe koneksi
      const [custInfo] = await this.db
        .select({ connectionType: customers.connectionType, mikrotikConfigId: customers.mikrotikConfigId })
        .from(customers)
        .where(eq(customers.id, item.customerId))
        .limit(1);

      try {
        if (custInfo?.connectionType === 'hotspot') {
          // ── Hotspot: disable + kick session di Mikrotik ─────────────────────
          if (custInfo.mikrotikConfigId) {
            const [mtkConfig] = await this.db
              .select()
              .from(mikrotikConfigs)
              .where(eq(mikrotikConfigs.id, custInfo.mikrotikConfigId))
              .limit(1);

            if (mtkConfig) {
              await this.mikrotikService.disableHotspotUser(mtkConfig, item.usernamePppoe);
            }
          }
        } else {
          // ── PPPoE: RADIUS & Mikrotik WAJIB dicoba independen ────────────────
          // Sebelumnya kedua panggilan ini berurutan dalam satu try/catch: kalau
          // radiusService.disableUser() lempar error, kickSession() ke Mikrotik
          // TIDAK PERNAH dijalankan — akibatnya sesi PPPoE yang sedang aktif
          // tetap hidup walau status pelanggan sudah "isolated" di database.
          // Sekarang keduanya dipisah jadi try/catch sendiri-sendiri, supaya
          // salah satu gagal tidak menghalangi yang lain: akun RADIUS tetap
          // dinonaktifkan DAN sesi aktif di Mikrotik tetap dicoba diputus.
          try {
            await this.radiusService.disableUser(item.usernamePppoe);
          } catch (err) {
            this.logger.error(`❌ RADIUS disable gagal '${item.usernamePppoe}': ${err}`);
          }

          if (item.mikrotikHost) {
            try {
              await this.mikrotikService.kickSession(
                {
                  host: item.mikrotikHost,
                  port: item.mikrotikPort ?? 8728,
                  username: item.mikrotikUsername ?? '',
                  password: item.mikrotikPassword ?? '',
                },
                item.usernamePppoe,
              );
            } catch (err) {
              this.logger.error(`❌ Kick sesi Mikrotik gagal '${item.usernamePppoe}': ${err}`);
            }
          } else {
            // Ini penyebab paling umum "sudah isolir tapi internet masih nyala":
            // customer → package → ip_pool → mikrotik_config tidak lengkap,
            // jadi host Mikrotik tidak ketemu dan sesi PPPoE tidak bisa diputus.
            this.logger.warn(
              `⚠️ '${item.usernamePppoe}': Mikrotik config tidak ditemukan (cek Paket → IP Pool → ` +
              `Mikrotik Config pelanggan ini) — sesi PPPoE aktif TIDAK ikut diputus, hanya akun RADIUS yang dinonaktifkan`,
            );
          }
        }
      } catch (err) {
        this.logger.error(`❌ Gagal isolir '${item.usernamePppoe}': ${err}`);
      }

      // WA notif (sama untuk PPPoE dan Hotspot)
      const [customerData] = await this.db
        .select({ name: customers.name, phone: customers.phone })
        .from(customers)
        .where(eq(customers.id, item.customerId))
        .limit(1);

      const [billData] = await this.db
        .select({ billNumber: bills.billNumber, amount: bills.totalAmount })
        .from(bills)
        .where(eq(bills.id, item.billId))
        .limit(1);

      if (customerData?.phone && billData) {
        await this.whatsappService.queueNotification({
          tenantId: item.tenantId,
          phone: customerData.phone,
          message: await this.whatsappTemplatesService.render(
            'isolir',
            item.tenantId,
            {
              name: customerData.name,
              billNumber: billData.billNumber,
              amount: formatRupiah(billData.amount),
            },
          ),
          trigger: 'isolir',
          customerId: item.customerId,
          billId: item.billId,
        });
      }
    }
  }

  private async processReminderCheck() {
    const reminderBills = await this.db
      .select({
        id: bills.id,
        customerId: bills.customerId,
        tenantId: bills.tenantId,
        dueDate: bills.dueDate,
        amount: bills.totalAmount,
      })
      .from(bills)
      .where(
        and(
          sql`DATE(${bills.dueDate}) = DATE_ADD(CURDATE(), INTERVAL 2 DAY)`,
          eq(bills.status, 'unpaid'),
        ),
      );

    if (reminderBills.length === 0) return;

    this.logger.log(`📢 Reminder H-3: ${reminderBills.length} pelanggan akan dinotifikasi`);

    for (const item of reminderBills) {
      const [customerData] = await this.db
        .select({ name: customers.name, phone: customers.phone })
        .from(customers)
        .where(eq(customers.id, item.customerId))
        .limit(1);

      if (customerData?.phone) {
        await this.whatsappService.queueNotification({
          tenantId: item.tenantId,
          phone: customerData.phone,
          message: await this.whatsappTemplatesService.render(
            'reminder',
            item.tenantId,
            {
              name: customerData.name,
              billNumber: String(item.id),
              amount: formatRupiah(item.amount),
              dueDate: String(item.dueDate),
            },
          ),
          trigger: 'reminder',
          customerId: item.customerId,
          billId: item.id,
        });
      }
    }
  }
}