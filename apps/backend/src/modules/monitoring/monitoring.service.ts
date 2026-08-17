import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, like } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { customers, packages, ipPools, mikrotikConfigs } from '../../database/schema';
import { MikrotikService } from '../mikrotik/mikrotik.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class MonitoringService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private mikrotikService: MikrotikService,
  ) {}

  // ─── Search Pelanggan ──────────────────────────────────────────────────────
  async searchCustomers(search: string, user: AuthUser) {
    return this.db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        usernamePppoe: customers.usernamePppoe,
        connectionType: customers.connectionType,
      })
      .from(customers)
      .where(and(
        eq(customers.tenantId, user.tenantId),
        like(customers.name, `%${search}%`),
      ))
      .limit(10);
  }

  // ─── Session Pelanggan (PPPoE atau Hotspot) ────────────────────────────────
  async getCustomerSession(customerId: number, user: AuthUser) {
    const [row] = await this.db
      .select({
        name: customers.name,
        usernamePppoe: customers.usernamePppoe,
        connectionType: customers.connectionType,
        mikrotikConfigId: customers.mikrotikConfigId,
        hotspotProfile: customers.hotspotProfile,
        packageId: customers.packageId,
      })
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, user.tenantId)))
      .limit(1);

    if (!row) throw new NotFoundException('Pelanggan tidak ditemukan');

    if (!row.usernamePppoe) {
      return {
        found: false,
        connectionType: row.connectionType,
        customerName: row.name,
        reason: 'Pelanggan belum punya akun',
      };
    }

    if (row.connectionType === 'hotspot') {
      return this.getHotspotSession(row, user.tenantId);
    }
    return this.getPppoeSession(row, user.tenantId);
  }

  // ─── PPPoE Session ──────────────────────────────────────────────────────────
  private async getPppoeSession(
    row: {
      name: string;
      usernamePppoe: string | null;
      packageId: number | null;
    },
    tenantId: string,
  ) {
    if (!row.packageId) {
      return {
        found: false, connectionType: 'pppoe', customerName: row.name,
        reason: 'Paket belum dikonfigurasi',
      };
    }

    const config = await this.getPppoeMikrotikConfig(row.packageId, tenantId);
    if (!config) {
      return {
        found: false, connectionType: 'pppoe', customerName: row.name,
        reason: 'Mikrotik tidak dikonfigurasi untuk paket ini',
      };
    }

    try {
      const sessions = await this.mikrotikService.getActiveSessions(config, row.usernamePppoe!);
      const session  = sessions.find(s => s.name === row.usernamePppoe);

      if (!session) {
        return {
          found: true, connected: false, connectionType: 'pppoe',
          customerName: row.name, username: row.usernamePppoe,
          mikrotikId: config.id, mikrotikName: config.name,
          reason: 'Pelanggan sedang tidak online',
        };
      }

      const traffic = await this.mikrotikService.getInterfaceTraffic(
        config, `<pppoe-${row.usernamePppoe}>`
      ).catch(() => null);

      return {
        found: true, connected: true, connectionType: 'pppoe',
        customerName: row.name, username: row.usernamePppoe,
        mikrotikId: config.id, mikrotikName: config.name,
        session: {
          address: session.address,
          uptime: session.uptime,
          callerId: session.callerId,
        },
        traffic,
      };
    } catch (err) {
      return {
        found: true, connected: false, connectionType: 'pppoe',
        customerName: row.name, username: row.usernamePppoe,
        reason: `Gagal cek sesi: ${err.message}`,
      };
    }
  }

  // ─── Hotspot Session ────────────────────────────────────────────────────────
  private async getHotspotSession(
    row: {
      name: string;
      usernamePppoe: string | null;
      mikrotikConfigId: number | null;
      hotspotProfile: string | null;
    },
    tenantId: string,
  ) {
    if (!row.mikrotikConfigId) {
      return {
        found: false, connectionType: 'hotspot', customerName: row.name,
        reason: 'Mikrotik belum dipilih untuk pelanggan ini',
      };
    }

    const [config] = await this.db
      .select()
      .from(mikrotikConfigs)
      .where(and(
        eq(mikrotikConfigs.id, row.mikrotikConfigId),
        eq(mikrotikConfigs.tenantId, tenantId),
      ))
      .limit(1);

    if (!config) {
      return {
        found: false, connectionType: 'hotspot', customerName: row.name,
        reason: 'Konfigurasi Mikrotik tidak ditemukan',
      };
    }

    try {
      const session = await this.mikrotikService.getHotspotActiveSession(
        config, row.usernamePppoe!
      );

      if (!session) {
        return {
          found: true, connected: false, connectionType: 'hotspot',
          customerName: row.name, username: row.usernamePppoe,
          mikrotikId: config.id, mikrotikName: config.name,
          hotspotProfile: row.hotspotProfile,
          reason: 'Pelanggan sedang tidak online',
        };
      }

      return {
        found: true, connected: true, connectionType: 'hotspot',
        customerName: row.name, username: row.usernamePppoe,
        mikrotikId: config.id, mikrotikName: config.name,
        hotspotProfile: row.hotspotProfile,
        session: {
          address: session.address,
          uptime: session.uptime,
          macAddress: session.macAddress,
          bytesIn: session.bytesIn,
          bytesOut: session.bytesOut,
        },
        traffic: null, // hotspot tidak ada interface monitor-traffic per user
      };
    } catch (err) {
      return {
        found: true, connected: false, connectionType: 'hotspot',
        customerName: row.name, username: row.usernamePppoe,
        reason: `Gagal cek sesi: ${err.message}`,
      };
    }
  }

  // ─── Kick Session ──────────────────────────────────────────────────────────
  async kickSession(customerId: number, user: AuthUser) {
    const [row] = await this.db
      .select({
        name: customers.name,
        usernamePppoe: customers.usernamePppoe,
        connectionType: customers.connectionType,
        mikrotikConfigId: customers.mikrotikConfigId,
        packageId: customers.packageId,
      })
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, user.tenantId)))
      .limit(1);

    if (!row) throw new NotFoundException('Pelanggan tidak ditemukan');
    if (!row.usernamePppoe) return { success: false, reason: 'Tidak ada username' };

    if (row.connectionType === 'hotspot') {
      const [config] = row.mikrotikConfigId
        ? await this.db.select().from(mikrotikConfigs)
            .where(eq(mikrotikConfigs.id, row.mikrotikConfigId)).limit(1)
        : [null];

      if (!config) return { success: false, reason: 'Mikrotik tidak ditemukan' };

      try {
        // Kick hotspot active session (bukan disable user)
        await this.mikrotikService.kickHotspotSession(config, row.usernamePppoe);
        return { success: true, message: `Sesi hotspot '${row.usernamePppoe}' diputus` };
      } catch (err) {
        return { success: false, reason: err.message };
      }
    } else {
      // PPPoE
      if (!row.packageId) return { success: false, reason: 'Paket tidak dikonfigurasi' };
      const config = await this.getPppoeMikrotikConfig(row.packageId, user.tenantId);
      if (!config) return { success: false, reason: 'Mikrotik tidak ditemukan' };

      try {
        await this.mikrotikService.kickSession(config, row.usernamePppoe);
        return { success: true, message: `Sesi PPPoE '${row.usernamePppoe}' diputus` };
      } catch (err) {
        return { success: false, reason: err.message };
      }
    }
  }

  // ─── Traffic (PPPoE only) ──────────────────────────────────────────────────
  async getSessionTraffic(customerId: number, user: AuthUser) {
    const [row] = await this.db
      .select({
        usernamePppoe: customers.usernamePppoe,
        connectionType: customers.connectionType,
        packageId: customers.packageId,
      })
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, user.tenantId)))
      .limit(1);

    if (!row) throw new NotFoundException('Pelanggan tidak ditemukan');

    if (row.connectionType === 'hotspot') {
      return { available: false, reason: 'Traffic monitoring tidak tersedia untuk Hotspot' };
    }

    if (!row.packageId || !row.usernamePppoe) {
      return { available: false, reason: 'Paket atau username tidak ada' };
    }

    const config = await this.getPppoeMikrotikConfig(row.packageId, user.tenantId);
    if (!config) return { available: false, reason: 'Mikrotik tidak dikonfigurasi' };

    const traffic = await this.mikrotikService.getInterfaceTraffic(
      config, `<pppoe-${row.usernamePppoe}>`
    ).catch(() => null);

    return {
      available: !!traffic,
      ...(traffic ?? { rxBps: 0, txBps: 0 }),
    };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────
  private async getPppoeMikrotikConfig(packageId: number, tenantId: string) {
    const [pkg] = await this.db
      .select({ ipPoolId: packages.ipPoolId })
      .from(packages).where(eq(packages.id, packageId)).limit(1);
    if (!pkg?.ipPoolId) return null;

    const [pool] = await this.db
      .select({ mikrotikConfigId: ipPools.mikrotikConfigId })
      .from(ipPools).where(eq(ipPools.id, pkg.ipPoolId)).limit(1);
    if (!pool) return null;

    const [config] = await this.db
      .select()
      .from(mikrotikConfigs)
      .where(and(
        eq(mikrotikConfigs.id, pool.mikrotikConfigId),
        eq(mikrotikConfigs.tenantId, tenantId),
        eq(mikrotikConfigs.isActive, true),
      ))
      .limit(1);

    return config ?? null;
  }
}