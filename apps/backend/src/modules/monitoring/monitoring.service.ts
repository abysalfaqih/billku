import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, like, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { customers, packages, ipPools, mikrotikConfigs } from '../../database/schema';
import { MikrotikService, describeMikrotikError } from '../mikrotik/mikrotik.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

/**
 * Keadaan sesi pelanggan di router, dari sudut pandang admin:
 *  - online       : ada sesi aktif
 *  - offline      : router menjawab, tidak ada sesi (hotspot: akun ada & aktif, hanya sedang tidak dipakai)
 *  - disabled     : akun hotspot ada tetapi dinonaktifkan di router (biasanya karena diisolir)
 *  - missing      : akun hotspot TIDAK ADA di router yang dipilih
 *  - unreachable  : router tidak menjawab / menolak — sesi tidak diketahui (BUKAN berarti offline)
 *  - unconfigured : data pelanggan belum lengkap (tanpa username / router / paket)
 */
export type SessionState = 'online' | 'offline' | 'disabled' | 'missing' | 'unreachable' | 'unconfigured';

/** Karakter khusus LIKE dibuat harfiah, supaya mengetik "50%" atau "a_b" tidak mencocokkan semuanya. */
function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private mikrotikService: MikrotikService,
  ) {}

  // ─── Search Pelanggan ──────────────────────────────────────────────────────
  // Mencocokkan nama, username (kode voucher), atau nomor HP. Hasil yang username-nya persis sama
  // tampil paling atas, disusul yang diawali ketikan, supaya kode voucher tidak tertimbun nama.
  async searchCustomers(search: string, user: AuthUser) {
    const q = search.trim();
    const esc = escapeLike(q);
    const contains = `%${esc}%`;
    const prefix = `${esc}%`;
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
        or(
          like(customers.name, contains),
          like(customers.usernamePppoe, contains),
          like(customers.phone, contains),
        ),
      ))
      .orderBy(
        sql`CASE WHEN ${customers.usernamePppoe} = ${q} THEN 0
                 WHEN ${customers.usernamePppoe} LIKE ${prefix} THEN 1
                 WHEN ${customers.name} LIKE ${prefix} THEN 2
                 ELSE 3 END`,
        customers.name,
      )
      .limit(10);
  }

  // ─── Session Pelanggan (PPPoE atau Hotspot) ────────────────────────────────
  async getCustomerSession(customerId: number, user: AuthUser) {
    const [row] = await this.db
      .select({
        name: customers.name,
        usernamePppoe: customers.usernamePppoe,
        passwordPppoe: customers.passwordPppoe,
        connectionType: customers.connectionType,
        mikrotikConfigId: customers.mikrotikConfigId,
        hotspotProfile: customers.hotspotProfile,
        packageId: customers.packageId,
        status: customers.status,
      })
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, user.tenantId)))
      .limit(1);

    if (!row) throw new NotFoundException('Pelanggan tidak ditemukan');

    if (!row.usernamePppoe) {
      return this.result(row, 'unconfigured', {
        found: false,
        reason: 'Pelanggan belum punya akun (username). Lengkapi di Edit Pelanggan.',
      });
    }

    if (row.connectionType === 'hotspot') {
      return this.getHotspotSession(row, user.tenantId);
    }
    return this.getPppoeSession(row, user.tenantId);
  }

  /**
   * Bentuk respons tunggal. `found` / `connected` dipertahankan agar halaman lama tetap jalan;
   * `state` adalah sumber kebenaran yang dipakai tampilan baru.
   */
  private result(
    row: { name: string; usernamePppoe: string | null; connectionType: 'pppoe' | 'hotspot'; status: string },
    state: SessionState,
    extra: Record<string, unknown> = {},
  ) {
    return {
      found: state !== 'unconfigured',
      connected: state === 'online',
      state,
      connectionType: row.connectionType,
      customerName: row.name,
      username: row.usernamePppoe,
      customerStatus: row.status,
      ...extra,
    };
  }

  // ─── PPPoE Session ──────────────────────────────────────────────────────────
  private async getPppoeSession(
    row: {
      name: string;
      usernamePppoe: string | null;
      connectionType: 'pppoe' | 'hotspot';
      status: string;
      packageId: number | null;
    },
    tenantId: string,
  ) {
    if (!row.packageId) {
      return this.result(row, 'unconfigured', { reason: 'Paket belum dikonfigurasi' });
    }

    const config = await this.getPppoeMikrotikConfig(row.packageId, tenantId);
    if (!config) {
      return this.result(row, 'unconfigured', { reason: 'Mikrotik tidak dikonfigurasi untuk paket ini' });
    }

    const where = { mikrotikId: config.id, mikrotikName: config.name };
    try {
      const info = await this.mikrotikService.inspectPppoe(config, row.usernamePppoe!);

      if (!info.session) {
        return this.result(row, 'offline', { ...where, reason: 'Pelanggan sedang tidak online' });
      }

      return this.result(row, 'online', {
        ...where,
        session: info.session,
        traffic: info.traffic,
      });
    } catch (err) {
      return this.unreachable(row, config, err, where);
    }
  }

  // ─── Hotspot Session ────────────────────────────────────────────────────────
  private async getHotspotSession(
    row: {
      name: string;
      usernamePppoe: string | null;
      passwordPppoe: string | null;
      connectionType: 'pppoe' | 'hotspot';
      status: string;
      mikrotikConfigId: number | null;
      hotspotProfile: string | null;
    },
    tenantId: string,
  ) {
    if (!row.mikrotikConfigId) {
      return this.result(row, 'unconfigured', {
        reason: 'Router hotspot belum dipilih untuk pelanggan ini. Pilih di Edit Pelanggan.',
      });
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
      return this.result(row, 'unconfigured', {
        reason: 'Router yang dipilih tidak ditemukan (mungkin sudah dihapus). Pilih ulang di Edit Pelanggan.',
      });
    }

    const where = { mikrotikId: config.id, mikrotikName: config.name, hotspotProfile: row.hotspotProfile };
    try {
      const info = await this.mikrotikService.inspectHotspotUser(config, row.usernamePppoe!);

      if (info.sessions.length > 0) {
        return this.result(row, 'online', {
          ...where,
          session: info.sessions[0],
          sessions: info.sessions,
          traffic: null, // hotspot tidak ada interface monitor-traffic per user
        });
      }

      if (!info.account) {
        return this.result(row, 'missing', {
          ...where,
          reason: `Voucher '${row.usernamePppoe}' tidak ada di router '${config.name}'. Kemungkinan salah router atau terhapus.`,
          canSync: row.status !== 'terminated' && !!row.passwordPppoe,
        });
      }

      if (info.account.disabled) {
        return this.result(row, 'disabled', {
          ...where,
          reason: row.status === 'active'
            ? 'Akun dinonaktifkan di router, padahal pelanggan berstatus aktif.'
            : 'Akun hotspot dimatikan di router sesuai status pelanggan.',
        });
      }

      return this.result(row, 'offline', {
        ...where,
        reason: 'Voucher ada di router, tetapi sedang tidak dipakai.',
      });
    } catch (err) {
      return this.unreachable(row, config, err, where);
    }
  }

  /** Router tidak menjawab/menolak: sesi TIDAK diketahui — jangan dilaporkan sebagai offline. */
  private unreachable(
    row: { name: string; usernamePppoe: string | null; connectionType: 'pppoe' | 'hotspot'; status: string },
    config: { name: string; host: string },
    err: unknown,
    where: Record<string, unknown>,
  ) {
    const d = describeMikrotikError(err);
    this.logger.warn(`Monitoring: router '${config.name}' (${config.host}) — ${d.kind}: ${err instanceof Error ? err.message : String(err)}`);
    return this.result(row, 'unreachable', { ...where, reason: d.message, errorKind: d.kind });
  }

  // ─── Sinkron Hotspot ───────────────────────────────────────────────────────
  // Membuat/memperbarui akun voucher di router yang dipilih pelanggan (aman diulang).
  // Pelanggan yang tidak aktif (isolir/suspended) dibuat dalam keadaan DINONAKTIFKAN,
  // supaya tombol ini tidak pernah membuka akses yang seharusnya terputus.
  async syncHotspot(customerId: number, user: AuthUser) {
    const [row] = await this.db
      .select({
        name: customers.name,
        usernamePppoe: customers.usernamePppoe,
        passwordPppoe: customers.passwordPppoe,
        connectionType: customers.connectionType,
        mikrotikConfigId: customers.mikrotikConfigId,
        hotspotProfile: customers.hotspotProfile,
        status: customers.status,
      })
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, user.tenantId)))
      .limit(1);

    if (!row) throw new NotFoundException('Pelanggan tidak ditemukan');
    if (row.connectionType !== 'hotspot') return { success: false, reason: 'Hanya untuk pelanggan hotspot' };
    if (!row.usernamePppoe || !row.passwordPppoe) {
      return { success: false, reason: 'Username atau password voucher belum lengkap' };
    }
    if (row.status === 'terminated') {
      return { success: false, reason: 'Pelanggan sudah berhenti, akun tidak disinkronkan' };
    }
    if (!row.mikrotikConfigId) return { success: false, reason: 'Router hotspot belum dipilih' };

    const [config] = await this.db
      .select()
      .from(mikrotikConfigs)
      .where(and(
        eq(mikrotikConfigs.id, row.mikrotikConfigId),
        eq(mikrotikConfigs.tenantId, user.tenantId),
      ))
      .limit(1);
    if (!config) return { success: false, reason: 'Router yang dipilih tidak ditemukan' };

    const disabled = row.status !== 'active';
    try {
      await this.mikrotikService.createHotspotUser(
        config, row.usernamePppoe, row.passwordPppoe, row.hotspotProfile ?? 'default', disabled,
      );
      // Baca ulang: jangan melapor sukses sebelum akunnya benar-benar terlihat di router.
      const check = await this.mikrotikService.inspectHotspotUser(config, row.usernamePppoe);
      if (!check.account) {
        return { success: false, reason: `Perintah terkirim, tetapi akun belum terlihat di router '${config.name}'` };
      }
      return {
        success: true,
        message: disabled
          ? `Akun '${row.usernamePppoe}' dibuat di '${config.name}' dalam keadaan nonaktif (pelanggan berstatus ${row.status})`
          : `Akun '${row.usernamePppoe}' berhasil disinkronkan ke '${config.name}'`,
      };
    } catch (err) {
      const d = describeMikrotikError(err);
      this.logger.warn(`Monitoring: sinkron hotspot '${row.usernamePppoe}' gagal di '${config.name}' — ${err instanceof Error ? err.message : String(err)}`);
      return { success: false, reason: d.kind === 'other' ? `Gagal menyinkronkan: ${err instanceof Error ? err.message : String(err)}` : d.message };
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
            .where(and(
              eq(mikrotikConfigs.id, row.mikrotikConfigId),
              eq(mikrotikConfigs.tenantId, user.tenantId),
            )).limit(1)
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