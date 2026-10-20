import { Injectable, Logger } from '@nestjs/common';
import { RouterOSAPI } from 'node-routeros';

export interface MikrotikConnection {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface ActiveSession {
  id: string;
  name: string;
  service: string;
  callerId: string;
  address: string;
  uptime: string;
}

// Dilempar method "Strict" kalau router tidak bisa dihubungi / login gagal.
// Dipisah dari error perintah supaya pemanggil (IsolirScheduler) bisa langsung
// melewati sisa pelanggan di router yang sama alih-alih menunggu timeout
// berulang-ulang untuk tiap pelanggan.
export class MikrotikUnreachableError extends Error {
  constructor(host: string, cause: unknown) {
    super(`Mikrotik ${host} tidak dapat dihubungi: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'MikrotikUnreachableError';
  }
}

// Mikrotik membalas "!empty" / UNKNOWNREPLY untuk "tidak ada data" — itu bukan error.
function isEmptyReply(err: unknown): boolean {
  const e = err as { errno?: string; message?: string } | null | undefined;
  return e?.errno === 'UNKNOWNREPLY' || String(e?.message ?? '').includes('!empty');
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class MikrotikService {
  private readonly logger = new Logger(MikrotikService.name);

  private async withConnection<T>(
    config: MikrotikConnection,
    callback: (api: RouterOSAPI) => Promise<T>,
  ): Promise<T> {
    const api = new RouterOSAPI({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      timeout: 15,
    });
    await api.connect();
    try {
      return await callback(api);
    } finally {
      api.close();
    }
  }

  // Untuk operasi yang HASILNYA harus dipastikan (isolir): gagal konek dibedakan
  // dari gagal perintah, dan tidak ada error yang ditelan.
  private async withStrictConnection<T>(
    config: MikrotikConnection,
    callback: (api: RouterOSAPI) => Promise<T>,
  ): Promise<T> {
    const api = new RouterOSAPI({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      timeout: 15,
    });
    try {
      await api.connect();
    } catch (err) {
      throw new MikrotikUnreachableError(config.host, err);
    }
    try {
      return await callback(api);
    } finally {
      try { api.close(); } catch { /* ignore */ }
    }
  }

  private async withConnectionSafe<T>(
    config: MikrotikConnection,
    callback: (api: RouterOSAPI) => Promise<T>,
    fallbackValue: T,
  ): Promise<T> {
    const api = new RouterOSAPI({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      timeout: 15,
    });
    await api.connect();
    try {
      return await callback(api);
    } catch (err: any) {
      // !empty = Mikrotik reply valid "tidak ada data" — anggap sukses
      if (err?.errno === 'UNKNOWNREPLY' || String(err?.message).includes('!empty')) {
        this.logger.debug(`Mikrotik !empty reply (normal): ${err.message}`);
        return fallbackValue;
      }
      throw err;
    } finally {
      try { api.close(); } catch { /* ignore */ }
    }
  }

  // ─── System ────────────────────────────────────────────────────────────────

  async testConnection(config: MikrotikConnection): Promise<{ connected: boolean; identity?: string }> {
    try {
      const identity = await this.withConnection(config, async (api) => {
        const res = await api.write('/system/identity/print');
        return res?.[0]?.name as string | undefined;
      });
      this.logger.log(`✅ Mikrotik ${config.host}: terhubung (${identity})`);
      return { connected: true, identity };
    } catch (err) {
      this.logger.warn(`❌ Mikrotik ${config.host}: gagal — ${err}`);
      return { connected: false };
    }
  }

  // ─── IP Pool ───────────────────────────────────────────────────────────────

  async createIpPool(config: MikrotikConnection, name: string, ipStart: string, ipEnd: string): Promise<void> {
    await this.withConnection(config, async (api) => {
      await api.write('/ip/pool/add', [`=name=${name}`, `=ranges=${ipStart}-${ipEnd}`]);
    });
    this.logger.log(`✅ Mikrotik: IP Pool '${name}' dibuat`);
  }

  async deleteIpPool(config: MikrotikConnection, name: string): Promise<void> {
    await this.withConnectionSafe(config, async (api) => {
      try {
        const pools = await api.write('/ip/pool/print', [`?name=${name}`]);
        if (pools.length > 0) {
          await api.write('/ip/pool/remove', [`=.id=${pools[0]['.id']}`]).catch((err: any) => {
            if (err?.errno !== 'UNKNOWNREPLY') throw err;
          });
        }
      } catch (err: any) {
        if (err?.errno !== 'UNKNOWNREPLY') throw err;
      }
      return null;
    }, null);
  }

  // ─── PPPoE Profile ─────────────────────────────────────────────────────────

  async createPppoeProfile(
    config: MikrotikConnection,
    name: string,
    gateway: string,
    poolName: string,
    dnsPrimary: string,
    dnsSecondary: string,
  ): Promise<void> {
    await this.withConnection(config, async (api) => {
      await api.write('/ppp/profile/add', [
        `=name=${name}`,
        `=local-address=${gateway}`,
        `=remote-address=${poolName}`,
        `=dns-server=${dnsPrimary},${dnsSecondary}`,
        `=use-encryption=yes`,
      ]);
    });
    this.logger.log(`✅ Mikrotik: PPPoE Profile '${name}' dibuat`);
  }

  async deletePppoeProfile(config: MikrotikConnection, name: string): Promise<void> {
    await this.withConnectionSafe(config, async (api) => {
      try {
        const profiles = await api.write('/ppp/profile/print', [`?name=${name}`]);
        if (profiles.length > 0) {
          await api.write('/ppp/profile/remove', [`=.id=${profiles[0]['.id']}`]).catch((err: any) => {
            if (err?.errno !== 'UNKNOWNREPLY') throw err;
          });
        }
      } catch (err: any) {
        if (err?.errno !== 'UNKNOWNREPLY') throw err;
      }
      return null;
    }, null);
  }

  // ─── PPPoE Secret ──────────────────────────────────────────────────────────

  async updatePppoeSecret(
    config: MikrotikConnection,
    username: string,
    updates: { password?: string; profile?: string },
  ): Promise<boolean> {
    try {
      return await this.withConnection(config, async (api) => {
        const secrets = await api.write('/ppp/secret/print', [`?name=${username}`]);
        if (!secrets.length) return false;
        const args = [`=.id=${secrets[0]['.id']}`];
        if (updates.password) args.push(`=password=${updates.password}`);
        if (updates.profile)  args.push(`=profile=${updates.profile}`);
        await api.write('/ppp/secret/set', args);
        this.logger.log(`✅ Mikrotik: PPPoE secret '${username}' diperbarui`);
        return true;
      });
    } catch (err) {
      this.logger.error(`Mikrotik: gagal update secret '${username}': ${err}`);
      return false;
    }
  }

  async renamePppoeSecret(
    config: MikrotikConnection,
    oldUsername: string,
    newUsername: string,
  ): Promise<boolean> {
    try {
      return await this.withConnection(config, async (api) => {
        const secrets = await api.write('/ppp/secret/print', [`?name=${oldUsername}`]);
        if (!secrets.length) return false;
        await api.write('/ppp/secret/set', [
          `=.id=${secrets[0]['.id']}`,
          `=name=${newUsername}`,
        ]);
        this.logger.log(`✅ Mikrotik: rename secret '${oldUsername}' → '${newUsername}'`);
        return true;
      });
    } catch (err) {
      this.logger.error(`Mikrotik: gagal rename secret: ${err}`);
      return false;
    }
  }

  async deletePppoeSecret(config: MikrotikConnection, username: string): Promise<void> {
    await this.withConnectionSafe(config, async (api) => {
      // Putus sesi aktif dulu — supaya koneksi internet berhenti seketika,
      // sebelum secret-nya sendiri dihapus.
      try {
        const active = await api.write('/ppp/active/print', [`?name=${username}`]);
        for (const s of active) {
          await api.write('/ppp/active/remove', [`=.id=${s['.id']}`]).catch(() => {});
        }
        if (active.length > 0) {
          this.logger.log(`🔴 Mikrotik: ${active.length} sesi PPPoE '${username}' diputus`);
        }
      } catch { /* ok */ }

      // Hapus secret-nya
      try {
        const secrets = await api.write('/ppp/secret/print', [`?name=${username}`]);
        if (secrets.length > 0) {
          await api.write('/ppp/secret/remove', [`=.id=${secrets[0]['.id']}`]).catch((err: any) => {
            if (err?.errno !== 'UNKNOWNREPLY') throw err;
          });
          this.logger.log(`🗑️ Mikrotik: PPPoE secret '${username}' dihapus`);
        }
      } catch (err: any) {
        if (err?.errno !== 'UNKNOWNREPLY') throw err;
      }
      return null;
    }, null);
  }

  // ─── PPPoE Active Session ──────────────────────────────────────────────────

  async kickSession(config: MikrotikConnection, username: string): Promise<boolean> {
    try {
      return await this.withConnection(config, async (api) => {
        const sessions = await api.write('/ppp/active/print', [`?name=${username}`]);
        if (!sessions.length) return false;
        for (const s of sessions) {
          await api.write('/ppp/active/remove', [`=.id=${s['.id']}`]);
        }
        this.logger.log(`🔴 Mikrotik: PPPoE session '${username}' diputus`);
        return true;
      });
    } catch (err) {
      this.logger.error(`Mikrotik: gagal kick PPPoE '${username}': ${err}`);
      return false;
    }
  }

  /**
   * Seperti kickSession(), tetapi TIDAK menelan error: lempar kalau router tidak
   * terjangkau atau perintah gagal. Mengembalikan jumlah sesi yang diputus
   * (0 = pelanggan memang sedang tidak online — itu sukses, bukan gagal).
   * Dipakai IsolirScheduler yang harus tahu pasti apakah pemutusan berhasil.
   */
  async kickSessionStrict(config: MikrotikConnection, username: string): Promise<number> {
    return this.withStrictConnection(config, async (api) => {
      let sessions: any[] = [];
      try {
        sessions = await api.write('/ppp/active/print', [`?name=${username}`]);
      } catch (err) {
        if (!isEmptyReply(err)) throw err;
      }
      for (const s of sessions) {
        try {
          await api.write('/ppp/active/remove', [`=.id=${s['.id']}`]);
        } catch (err) {
          if (!isEmptyReply(err)) throw err;
        }
      }
      if (sessions.length > 0) {
        this.logger.log(`🔴 Mikrotik: PPPoE session '${username}' diputus (${sessions.length} sesi)`);
      }
      return sessions.length;
    });
  }

  async getActiveSessions(config: MikrotikConnection, username?: string): Promise<ActiveSession[]> {
    return this.withConnection(config, async (api) => {
      const params = username ? [`?name=${username}`] : [];
      const result = await api.write('/ppp/active/print', params);
      return result.map((r) => ({
        id: r['.id'],
        name: r.name ?? '',
        service: r.service ?? '',
        callerId: r['caller-id'] ?? '',
        address: r.address ?? '',
        uptime: r.uptime ?? '',
      }));
    });
  }

  async getInterfaceTraffic(
    config: MikrotikConnection,
    interfaceName: string,
  ): Promise<{ rxBps: number; txBps: number } | null> {
    try {
      return await this.withConnection(config, async (api) => {
        const result = await api.write('/interface/monitor-traffic', [
          `=interface=${interfaceName}`,
          '=once=',
        ]);
        const row = result?.[0];
        if (!row) return null;
        return {
          rxBps: Number(row['rx-bits-per-second'] ?? 0),
          txBps: Number(row['tx-bits-per-second'] ?? 0),
        };
      });
    } catch {
      return null;
    }
  }

  // ─── Hotspot Profile ───────────────────────────────────────────────────────

  async getHotspotProfiles(config: MikrotikConnection): Promise<string[]> {
    return this.withConnectionSafe(config, async (api) => {
      try {
        const profiles = await api.write('/ip/hotspot/user/profile/print');
        return profiles
          .map((p: any) => String(p.name ?? ''))
          .filter((name: string) => name && name !== 'default');
      } catch (err: any) {
        if (err?.errno === 'UNKNOWNREPLY') return [];
        throw err;
      }
    }, []);
  }

  // ─── Hotspot User ──────────────────────────────────────────────────────────

  async createHotspotUser(
    config: MikrotikConnection,
    username: string,
    password: string,
    profile: string,
  ): Promise<void> {
    await this.withConnectionSafe(config, async (api) => {
      // Cek apakah user sudah ada
      let existingId: string | null = null;
      try {
        const existing = await api.write('/ip/hotspot/user/print', [`?name=${username}`]);
        if (existing.length > 0) {
          existingId = existing[0]['.id'];
        }
      } catch (err: any) {
        if (err?.errno !== 'UNKNOWNREPLY') throw err;
      }

      if (existingId) {
        // Update user yang sudah ada
        try {
          await api.write('/ip/hotspot/user/set', [
            `=.id=${existingId}`,
            `=password=${password}`,
            `=profile=${profile}`,
            `=disabled=no`,
          ]);
        } catch (err: any) {
          if (err?.errno !== 'UNKNOWNREPLY') throw err;
        }
        this.logger.log(`🔄 Mikrotik Hotspot: user '${username}' diperbarui`);
      } else {
        // Buat user baru
        try {
          await api.write('/ip/hotspot/user/add', [
            `=name=${username}`,
            `=password=${password}`,
            `=profile=${profile}`,
            `=disabled=no`,
          ]);
        } catch (err: any) {
          if (err?.errno !== 'UNKNOWNREPLY') throw err;
        }
        this.logger.log(`✅ Mikrotik Hotspot: user '${username}' dibuat (profile: ${profile})`);
      }
      return null;
    }, null);
  }

  async disableHotspotUser(config: MikrotikConnection, username: string): Promise<void> {
    await this.withConnectionSafe(config, async (api) => {
      // 1. Disable akun (supaya tidak bisa login lagi ke depannya).
      //    PENTING: error di sini TIDAK BOLEH throw — kalau throw, langkah 2 di
      //    bawah (putus sesi aktif) tidak akan pernah dijalankan, dan user yang
      //    seharusnya diisolir akan tetap konek internet.
      try {
        const users = await api.write('/ip/hotspot/user/print', [`?name=${username}`]);
        if (users.length > 0) {
          await api.write('/ip/hotspot/user/set', [
            `=.id=${users[0]['.id']}`,
            `=disabled=yes`,
          ]).catch((err: any) => {
            if (err?.errno !== 'UNKNOWNREPLY') throw err;
          });
        }
      } catch (err: any) {
        if (err?.errno !== 'UNKNOWNREPLY') {
          this.logger.error(`Mikrotik Hotspot: gagal disable akun '${username}': ${err}`);
        }
      }

      // 2. Putus sesi aktif — tetap dicoba walau langkah 1 gagal di atas.
      try {
        const active = await api.write('/ip/hotspot/active/print', [`?user=${username}`]);
        for (const s of active) {
          await api.write('/ip/hotspot/active/remove', [`=.id=${s['.id']}`]).catch(() => {});
        }
        if (active.length > 0) {
          this.logger.log(`🔴 Hotspot: ${active.length} sesi '${username}' diputus`);
        }
      } catch (err: any) {
        if (err?.errno !== 'UNKNOWNREPLY') {
          this.logger.error(`Mikrotik Hotspot: gagal kick sesi aktif '${username}': ${err}`);
        }
      }

      this.logger.log(`🔴 Mikrotik Hotspot: user '${username}' disabled`);
      return null;
    }, null);
  }

  /**
   * Seperti disableHotspotUser(), tetapi gagal = THROW. Kedua langkah (disable
   * akun, putus sesi aktif) tetap dicoba semua; kalau ada yang gagal, error
   * dilempar di akhir. User yang tidak ada di router dianggap sukses — tidak
   * ada akun yang bisa dipakai login.
   */
  async disableHotspotUserStrict(config: MikrotikConnection, username: string): Promise<void> {
    await this.withStrictConnection(config, async (api) => {
      const failures: string[] = [];

      try {
        const users = await api.write('/ip/hotspot/user/print', [`?name=${username}`]);
        if (users.length > 0) {
          await api.write('/ip/hotspot/user/set', [`=.id=${users[0]['.id']}`, `=disabled=yes`])
            .catch((err: unknown) => { if (!isEmptyReply(err)) throw err; });
        } else {
          this.logger.warn(`Hotspot: user '${username}' tidak ada di router — tidak ada akun yang perlu dinonaktifkan`);
        }
      } catch (err) {
        if (!isEmptyReply(err)) failures.push(`disable akun: ${errorMessage(err)}`);
      }

      try {
        const active = await api.write('/ip/hotspot/active/print', [`?user=${username}`]);
        for (const s of active) {
          await api.write('/ip/hotspot/active/remove', [`=.id=${s['.id']}`])
            .catch((err: unknown) => { if (!isEmptyReply(err)) throw err; });
        }
        if (active.length > 0) {
          this.logger.log(`🔴 Hotspot: ${active.length} sesi '${username}' diputus`);
        }
      } catch (err) {
        if (!isEmptyReply(err)) failures.push(`putus sesi: ${errorMessage(err)}`);
      }

      if (failures.length > 0) {
        throw new Error(`Hotspot '${username}': ${failures.join('; ')}`);
      }
      this.logger.log(`🔴 Mikrotik Hotspot: user '${username}' disabled`);
    });
  }

  async enableHotspotUser(config: MikrotikConnection, username: string): Promise<void> {
    await this.withConnectionSafe(config, async (api) => {
      try {
        const users = await api.write('/ip/hotspot/user/print', [`?name=${username}`]);
        if (!users.length) {
          this.logger.warn(`Hotspot: user '${username}' tidak ditemukan`);
          return null;
        }
        await api.write('/ip/hotspot/user/set', [
          `=.id=${users[0]['.id']}`,
          `=disabled=no`,
        ]).catch((err: any) => {
          if (err?.errno !== 'UNKNOWNREPLY') throw err;
        });
      } catch (err: any) {
        if (err?.errno !== 'UNKNOWNREPLY') throw err;
      }
      this.logger.log(`🟢 Mikrotik Hotspot: user '${username}' enabled`);
      return null;
    }, null);
  }

  async deleteHotspotUser(config: MikrotikConnection, username: string): Promise<void> {
    await this.withConnectionSafe(config, async (api) => {
      // Kick active sessions dulu
      try {
        const active = await api.write('/ip/hotspot/active/print', [`?user=${username}`]);
        for (const s of active) {
          await api.write('/ip/hotspot/active/remove', [`=.id=${s['.id']}`]).catch(() => {});
        }
      } catch { /* ok */ }

      // Hapus user
      try {
        const users = await api.write('/ip/hotspot/user/print', [`?name=${username}`]);
        if (users.length > 0) {
          await api.write('/ip/hotspot/user/remove', [`=.id=${users[0]['.id']}`]).catch((err: any) => {
            if (err?.errno !== 'UNKNOWNREPLY') throw err;
          });
          this.logger.log(`🗑️ Mikrotik Hotspot: user '${username}' dihapus`);
        }
      } catch (err: any) {
        if (err?.errno !== 'UNKNOWNREPLY') throw err;
      }
      return null;
    }, null);
  }

  async getHotspotActiveSession(
    config: MikrotikConnection,
    username: string,
  ): Promise<{
    address: string;
    uptime: string;
    macAddress: string;
    bytesIn: string;
    bytesOut: string;
  } | null> {
    return this.withConnectionSafe(config, async (api) => {
      try {
        const sessions = await api.write('/ip/hotspot/active/print', [`?user=${username}`]);
        if (!sessions.length) return null;
        const s = sessions[0];
        return {
          address:    s.address          ?? '-',
          uptime:     s.uptime           ?? '-',
          macAddress: s['mac-address']   ?? '-',
          bytesIn:    s['bytes-in']      ?? '0',
          bytesOut:   s['bytes-out']     ?? '0',
        };
      } catch (err: any) {
        if (err?.errno === 'UNKNOWNREPLY') return null;
        throw err;
      }
    }, null);
  }

  async kickHotspotSession(config: MikrotikConnection, username: string): Promise<void> {
    await this.withConnectionSafe(config, async (api) => {
      try {
        const sessions = await api.write('/ip/hotspot/active/print', [`?user=${username}`]);
        for (const s of sessions) {
          await api.write('/ip/hotspot/active/remove', [`=.id=${s['.id']}`]).catch((err: any) => {
            if (err?.errno !== 'UNKNOWNREPLY') throw err;
          });
        }
        this.logger.log(`🔴 Hotspot: kick session '${username}' (${sessions.length} sesi)`);
      } catch (err: any) {
        if (err?.errno !== 'UNKNOWNREPLY') throw err;
      }
      return null;
    }, null);
  }
}