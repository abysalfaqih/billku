import {
  Injectable, Inject, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { eq, and, count, ne } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import {
  tenantSubscriptions, subscriptionPlans,
  customers, mikrotikConfigs, ipPools, users,
} from '../../database/schema';

@Injectable()
export class SubscriptionService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  // ── Core: ambil plan aktif (throw kalau tidak ada) ─────────────────────────
  async requireActiveSubscription(tenantId: string) {
    const [sub] = await this.db
      .select({ planId: tenantSubscriptions.planId, status: tenantSubscriptions.status })
      .from(tenantSubscriptions)
      .where(and(
        eq(tenantSubscriptions.tenantId, tenantId),
        eq(tenantSubscriptions.status, 'active'),
      ))
      .limit(1);

    // Tidak ada langganan aktif → blokir
    if (!sub?.planId) {
      throw new ForbiddenException(
        'Tenant belum memiliki langganan aktif. Hubungi admin platform.',
      );
    }

    const [plan] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(and(
        eq(subscriptionPlans.id, sub.planId),
        eq(subscriptionPlans.isActive, true),
      ))
      .limit(1);

    if (!plan) {
      throw new ForbiddenException('Paket langganan tidak ditemukan atau sudah tidak aktif.');
    }

    return plan;
  }

  // ── Cek Limit ──────────────────────────────────────────────────────────────

  async checkCustomerLimit(tenantId: string): Promise<void> {
    const plan = await this.requireActiveSubscription(tenantId);
    if (plan.maxCustomers === -1) return; // unlimited

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        ne(customers.status, 'terminated'),
      ));

    if (total >= plan.maxCustomers) {
      throw new ForbiddenException(
        `Batas maksimal ${plan.maxCustomers} pelanggan aktif tercapai. ` +
        `Upgrade paket untuk menambah lebih banyak.`,
      );
    }
  }

  async checkMikrotikLimit(tenantId: string): Promise<void> {
    const plan = await this.requireActiveSubscription(tenantId);
    if (plan.maxMikrotik === -1) return;

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(mikrotikConfigs)
      .where(and(
        eq(mikrotikConfigs.tenantId, tenantId),
        eq(mikrotikConfigs.isActive, true),
      ));

    if (total >= plan.maxMikrotik) {
      throw new ForbiddenException(
        `Batas maksimal ${plan.maxMikrotik} Mikrotik tercapai. ` +
        `Upgrade paket untuk menambah lebih banyak.`,
      );
    }
  }

  async checkIpPoolLimit(tenantId: string): Promise<void> {
    const plan = await this.requireActiveSubscription(tenantId);
    if (plan.maxIpPools === -1) return;

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(ipPools)
      .where(and(
        eq(ipPools.tenantId, tenantId),
        eq(ipPools.isActive, true),
      ));

    if (total >= plan.maxIpPools) {
      throw new ForbiddenException(
        `Batas maksimal ${plan.maxIpPools} IP Pool tercapai. ` +
        `Upgrade paket untuk menambah lebih banyak.`,
      );
    }
  }

  async checkUserLimit(tenantId: string): Promise<void> {
    const plan = await this.requireActiveSubscription(tenantId);
    if (plan.maxUsers === -1) return;

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.isActive, true),
        ne(users.role, 'super_admin'),
      ));

    if (total >= plan.maxUsers) {
      throw new ForbiddenException(
        `Batas maksimal ${plan.maxUsers} pengguna aktif tercapai. ` +
        `Upgrade paket untuk menambah lebih banyak.`,
      );
    }
  }

  // ── Cek Fitur ──────────────────────────────────────────────────────────────

  async checkWhatsappFeature(tenantId: string): Promise<void> {
    const plan = await this.requireActiveSubscription(tenantId);
    if (!plan.hasWhatsapp) {
      throw new ForbiddenException(
        'Fitur WhatsApp tidak tersedia di paket Anda. Upgrade ke paket Standard atau lebih tinggi.',
      );
    }
  }

  async checkReportsFeature(tenantId: string): Promise<void> {
    const plan = await this.requireActiveSubscription(tenantId);
    if (!plan.hasReports) {
      throw new ForbiddenException(
        'Fitur Laporan tidak tersedia di paket Anda. Upgrade ke paket Standard atau lebih tinggi.',
      );
    }
  }

  async checkApiAccess(tenantId: string): Promise<void> {
    const plan = await this.requireActiveSubscription(tenantId);
    if (!plan.hasApiAccess) {
      throw new ForbiddenException(
        'Akses API tidak tersedia di paket Anda. Upgrade ke paket Premium.',
      );
    }
  }

  // ── Utilitas ───────────────────────────────────────────────────────────────

  async getActivePlanInfo(tenantId: string) {
    try {
      const plan = await this.requireActiveSubscription(tenantId);
      return {
        hasSubscription: true,
        plan,
        limits: {
          maxCustomers: plan.maxCustomers,
          maxMikrotik:  plan.maxMikrotik,
          maxIpPools:   plan.maxIpPools,
          maxUsers:     plan.maxUsers,
        },
        features: {
          whatsapp:  plan.hasWhatsapp,
          reports:   plan.hasReports,
          apiAccess: plan.hasApiAccess,
        },
      };
    } catch {
      return { hasSubscription: false };
    }
  }
}