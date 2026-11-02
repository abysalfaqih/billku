import { Injectable, Logger } from '@nestjs/common';
import { RouterOSAPI } from 'node-routeros';

export interface MikrotikConnection {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface HotspotActiveSession {
  address: string;
  uptime: string;
  macAddress: string;
  bytesIn: string;
  bytesOut: string;
}

/** Hasil pengecekan satu pelanggan hotspot: sesi yang aktif + keadaan akun voucher-nya di router. */
export interface HotspotInspection {
  /** semua sesi aktif user ini (bisa lebih dari satu bila dipakai di beberapa perangkat) */
  sessions: HotspotActiveSession[];
  /** akun di router; null = akun TIDAK ADA di router ini */
  account: { disabled: boolean; profile: string } | null;
}

export interface PppoeInspection {
  /** null = tidak sedang online */
  session: { address: string; uptime: string; callerId: string } | null;
  traffic: { rxBps: number; txBps: number } | null;
}

/** Batas keras untuk menyambung + login ke router; lewat dari ini dianggap tidak terjangkau. */
export const CONNECT_DEADLINE_MS = 10_000;
/** Batas total satu pengecekan Monitoring (sambung + semua perintah). */
export const MONITOR_DEADLINE_MS = 8_000;
/** Batas total operasi lain (membuat/mengubah/memutus user, dst.) — jaring pengaman bila router berhenti menjawab di tengah. */
export const OPERATION_DEADLINE_MS = 30_000;

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

/** Router tidak menyelesaikan pekerjaannya dalam batas waktu keras. */
export class MikrotikTimeoutError extends Error {
  constructor(host: string, ms: number) {
    super(`router ${host} tidak membalas dalam ${Math.round(ms / 1000)} detik`);
    this.name = 'MikrotikTimeoutError';
  }
}

export type MikrotikErrorKind = 'timeout' | 'refused' | 'unreachable' | 'auth' | 'other';

/**
 * Mengubah galat koneksi/perintah router menjadi jenis + kalimat yang bisa dibaca admin.
 * Dipakai Monitoring supaya "router mati/lambat" tidak tampak seperti "pelanggan offline".
 */
export function describeMikrotikError(err: unknown): { kind: MikrotikErrorKind; message: string } {
  const e = err as { errno?: string | number; code?: string; message?: string } | null | undefined;
  const text = String(e?.message ?? err ?? '');
  const code = String(e?.code ?? e?.errno ?? '');
  const inner = err instanceof MikrotikUnreachableError ? text : '';

  if (err instanceof MikrotikTimeoutError || code === 'SOCKTMOUT' || code === 'ETIMEDOUT'
      || /timed? ?out|tidak membalas/i.test(text)) {
    return { kind: 'timeout', message: 'Router tidak membalas (waktu habis). Pastikan router menyala dan bisa dijangkau dari server.' };
  }
  if (code === 'CANTLOGIN' || /cannot log in|invalid user name or password/i.test(text)) {
    return { kind: 'auth', message: 'Login ke router ditolak. Periksa username dan password API di menu Mikrotik.' };
  }
  if (code === 'ECONNREFUSED' || code === '-111' || /ECONNREFUSED/.test(text)) {
    return { kind: 'refused', message: 'Router menolak koneksi API. Pastikan layanan API aktif dan port-nya benar.' };
  }
  if (/EHOSTUNREACH|ENETUNREACH|ENOTFOUND|ECONNRESET|EPIPE|socket hang up|closed/i.test(`${code} ${text} ${inner}`)) {
    return { kind: 'unreachable', message: 'Router tidak dapat dijangkau dari server (koneksi terputus).' };
  }
  return { kind: 'other', message: `Gagal menghubungi router: ${text || 'galat tidak dikenal'}` };
}

// Mikrotik membalas "!empty" / UNKNOWNREPLY untuk "tidak ada data" — itu bukan error.
function isEmptyReply(err: unknown): boolean {
  const e = err as { errno?: string; message?: string } | null | undefined;
  return e?.errno === 'UNKNOWNREPLY' || String(e?.message ?? '').includes('!empty');
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Memutus soket secara paksa — api.close() tidak berbuat apa-apa selama koneksi belum selesai. */
function destroyApi(api: RouterOSAPI): void {
  try { api.connector?.destroy(); } catch { /* ignore */ }
  try { void Promise.resolve(api.close()).catch(() => undefined); } catch { /* ignore */ }
}

@Injectable()
export class MikrotikService {
  private readonly logger = new Logger(MikrotikService.name);

  /** Batas total operasi non-Monitoring; instance field agar bisa dipercepat saat diuji. */
  operationDeadlineMs = OPERATION_DEADLINE_MS;

  /** Satu-satunya tempat objek koneksi dibuat. */
  private createApi(config: MikrotikConnection): RouterOSAPI {
    const api = new RouterOSAPI({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      timeout: 15,
    });
    // Library memancarkan event 'error' pada koneksi yang sudah terbentuk (mis. soket habis waktu).
    // Tanpa listener, EventEmitter melempar error itu sebagai uncaught exception.
    api.on('error', (err: unknown) => {
      this.logger.debug(`Mikrotik ${config.host}: galat soket diabaikan — ${errorMessage(err)}`);
    });
    return api;
  }

  /**
   * Menjalankan `work` dengan batas waktu total. Library bisa menggantung SELAMANYA — bila router
   * menerima koneksi lalu memutusnya, atau berhenti menjawab di tengah perintah — karena promise
   * connect()/write() tidak pernah selesai dan batas waktu soketnya tidak menyelesaikannya. Bila
   * batas lewat, koneksi diputus paksa dan MikrotikTimeoutError dilempar.
   */
  private async guarded<T>(api: RouterOSAPI, host: string, ms: number, work: () => Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new MikrotikTimeoutError(host, ms));
      }, ms);
    });
    try {
      return await Promise.race([work(), expired]);
    } finally {
      clearTimeout(timer);
      // Hanya bila batas waktu yang menghentikannya: koneksi macet, jadi harus diputus paksa.
      // Galat biasa sudah ditangani pemanggilnya (api.close() di blok finally mereka).
      if (timedOut) destroyApi(api);
    }
  }

  /** Menyambung + login dengan batas waktu tersendiri (lebih pendek dari batas operasi). */
  private async connectWithDeadline(api: RouterOSAPI, host: string, ms = CONNECT_DEADLINE_MS): Promise<void> {
    await this.guarded(api, host, ms, () => api.connect());
  }

  /**
   * Untuk pengecekan Monitoring: sambung + SEMUA perintah dibatasi `ms` total, apa pun yang
   * dilakukan router — pemanggil tidak pernah menunggu lebih lama dari itu.
   */
  private async withDeadline<T>(
    config: MikrotikConnection,
    ms: number,
    callback: (api: RouterOSAPI) => Promise<T>,
  ): Promise<T> {
    const api = this.createApi(config);
    try {
      return await this.guarded(api, config.host, ms, async () => {
        await api.connect();
        return callback(api);
      });
    } finally {
      try { void Promise.resolve(api.close()).catch(() => undefined); } catch { /* ignore */ }
    }
  }

  private async withConnection<T>(
    config: MikrotikConnection,
    callback: (api: RouterOSAPI) => Promise<T>,
  ): Promise<T> {
    const api = this.createApi(config);
    return this.guarded(api, config.host, this.operationDeadlineMs, async () => {
      await this.connectWithDeadline(api, config.host);
      try {
        return await callback(api);
      } finally {
        api.close();
      }
    });
  }

  // Untuk operasi yang HASILNYA harus dipastikan (isolir): gagal konek dibedakan
  // dari gagal perintah, dan tidak ada error yang ditelan. Router yang tidak menjawab
  // (gagal konek ATAU macet di tengah perintah) = MikrotikUnreachableError.
  private async withStrictConnection<T>(
    config: MikrotikConnection,
    callback: (api: RouterOSAPI) => Promise<T>,
  ): Promise<T> {
    const api = this.createApi(config);
    return this.guarded(api, config.host, this.operationDeadlineMs, async () => {
      try {
        await this.connectWithDeadline(api, config.host);
      } catch (err) {
        throw new MikrotikUnreachableError(config.host, err);
      }
      try {
        return await callback(api);
      } finally {
        try { api.close(); } catch { /* ignore */ }
      }
    }).catch((err) => {
      if (err instanceof MikrotikTimeoutError) throw new MikrotikUnreachableError(config.host, err);
      throw err;
    });
  }

  private async withConnectionSafe<T>(
    config: MikrotikConnection,
    callback: (api: RouterOSAPI) => Promise<T>,
    fallbackValue: T,
  ): Promise<T> {
    const api = this.createApi(config);
    return this.guarded(api, config.host, this.operationDeadlineMs, async () => {
      await this.connectWithDeadline(api, config.host);
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
    });
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

  /**
   * Satu pengecekan PPPoE untuk Monitoring: sesi aktif + kecepatan saat ini, dalam SATU koneksi
   * dan dibatasi MONITOR_DEADLINE_MS. Gagal/terlambat = THROW (bukan "tidak online"), supaya
   * pemanggil bisa membedakan router bermasalah dari pelanggan yang memang sedang offline.
   */
  async inspectPppoe(config: MikrotikConnection, username: string): Promise<PppoeInspection> {
    return this.withDeadline(config, MONITOR_DEADLINE_MS, async (api) => {
      const rows = await this.printRows(api, '/ppp/active/print', [`?name=${username}`]);
      const row = rows.find((r) => r.name === username);
      if (!row) return { session: null, traffic: null };
      let traffic: { rxBps: number; txBps: number } | null = null;
      try {
        traffic = await this.readTraffic(api, `<pppoe-${username}>`);
      } catch (err) {
        if (err instanceof MikrotikTimeoutError) throw err;
        traffic = null; // kecepatan hanya pelengkap; sesinya sendiri sudah terbukti ada
      }
      return {
        session: { address: row.address ?? '', uptime: row.uptime ?? '', callerId: row['caller-id'] ?? '' },
        traffic,
      };
    });
  }

  async getInterfaceTraffic(
    config: MikrotikConnection,
    interfaceName: string,
  ): Promise<{ rxBps: number; txBps: number } | null> {
    try {
      return await this.withDeadline(config, MONITOR_DEADLINE_MS, (api) => this.readTraffic(api, interfaceName));
    } catch {
      return null;
    }
  }

  private async readTraffic(
    api: RouterOSAPI,
    interfaceName: string,
  ): Promise<{ rxBps: number; txBps: number } | null> {
    const result = await api.write('/interface/monitor-traffic', [`=interface=${interfaceName}`, '=once=']);
    const row = result?.[0];
    if (!row) return null;
    return {
      rxBps: Number(row['rx-bits-per-second'] ?? 0),
      txBps: Number(row['tx-bits-per-second'] ?? 0),
    };
  }

  /** `print` yang memperlakukan "tidak ada data" ("!empty") sebagai daftar kosong. */
  private async printRows(api: RouterOSAPI, command: string, params: string[]): Promise<Record<string, string>[]> {
    try {
      return await api.write(command, params);
    } catch (err) {
      if (isEmptyReply(err)) return [];
      throw err;
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
    disabled = false,
  ): Promise<void> {
    const disabledFlag = disabled ? 'yes' : 'no';
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
            `=disabled=${disabledFlag}`,
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
            `=disabled=${disabledFlag}`,
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

  /**
   * Satu pengecekan hotspot untuk Monitoring (satu koneksi, dibatasi MONITOR_DEADLINE_MS):
   * sesi aktif user + keadaan akunnya di router. Membedakan "sedang tidak dipakai" dari
   * "akun dinonaktifkan" dan "akun tidak ada di router ini". Gagal/terlambat = THROW.
   */
  async inspectHotspotUser(config: MikrotikConnection, username: string): Promise<HotspotInspection> {
    return this.withDeadline(config, MONITOR_DEADLINE_MS, async (api) => {
      const active = await this.printRows(api, '/ip/hotspot/active/print', [`?user=${username}`]);
      const users = await this.printRows(api, '/ip/hotspot/user/print', [`?name=${username}`]);
      const u = users[0];
      return {
        sessions: active.map((s) => ({
          address: s.address ?? '-',
          uptime: s.uptime ?? '-',
          macAddress: s['mac-address'] ?? '-',
          bytesIn: s['bytes-in'] ?? '0',
          bytesOut: s['bytes-out'] ?? '0',
        })),
        account: u ? { disabled: u.disabled === 'true' || u.disabled === 'yes', profile: u.profile ?? '' } : null,
      };
    });
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