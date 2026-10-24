import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { and, asc, eq, lt, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { MySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { activityLogs, refreshTokens, whatsappLogs } from '../../database/schema';
import { readNonNegativeInt } from '../../common/utils/config-int.util';

// Tabel log yang tumbuh terus dibersihkan seminggu sekali:
//   - whatsapp_logs : simpan LOG_RETENTION_WHATSAPP_MONTHS bulan terakhir (bawaan 2)
//   - activity_logs : simpan LOG_RETENTION_ACTIVITY_MONTHS bulan terakhir (bawaan 2)
//   - refresh_tokens: buang token yang sudah kedaluwarsa / dicabut lebih dari
//                     REFRESH_TOKEN_CLEANUP_DAYS hari (bawaan 1)
// Nilai 0 = tabel itu tidak dibersihkan. Tagihan & pembayaran TIDAK disentuh.
export const DEFAULT_WHATSAPP_RETENTION_MONTHS = 2;
export const DEFAULT_ACTIVITY_RETENTION_MONTHS = 2;
export const DEFAULT_REFRESH_TOKEN_CLEANUP_DAYS = 1;

// Hapus per batch (bukan satu DELETE raksasa) supaya tabel tidak terkunci lama
// dan request lain tetap sempat jalan di sela-sela.
export const CLEANUP_BATCH_SIZE = 5000;
export const CLEANUP_MAX_BATCHES = 1000; // pengaman: maksimal 5 juta baris per tabel per proses

export interface CleanupResult {
  table: string;
  deleted: number;
  /** Alasan tabel dilewati (mis. dimatikan lewat pengaturan) */
  skipped?: string;
  /** Pesan error kalau pembersihan tabel ini gagal — tabel lain tetap diproses */
  error?: string;
}

@Injectable()
export class CleanupScheduler {
  private readonly logger = new Logger(CleanupScheduler.name);
  private running = false;

  /** Jeda antar batch (ms). Public supaya bisa dipersingkat saat pengujian. */
  batchPauseMs = 100;

  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private config: ConfigService,
  ) {}

  // Minggu dini hari — sepi dari aktivitas, dan tidak bentrok dengan daily
  // check isolir (00:05).
  @Cron('0 3 * * 0')
  async handleWeeklyCleanup() {
    if (this.running) {
      this.logger.warn('⏭️ Pembersihan sebelumnya masih berjalan — proses kali ini dilewati');
      return;
    }
    try {
      await this.run();
    } catch (err) {
      this.logger.error('❌ Pembersihan mingguan gagal:', err);
    }
  }

  /** Dipakai cron dan trigger manual. Satu tabel gagal tidak menghentikan tabel lain. */
  async run(): Promise<CleanupResult[]> {
    if (this.running) {
      throw new ConflictException('Pembersihan sedang berjalan, coba lagi beberapa saat lagi');
    }
    this.running = true;
    try {
      this.logger.log('🧹 Pembersihan tabel log dimulai...');

      const waMonths = this.readCount('LOG_RETENTION_WHATSAPP_MONTHS', DEFAULT_WHATSAPP_RETENTION_MONTHS);
      const activityMonths = this.readCount('LOG_RETENTION_ACTIVITY_MONTHS', DEFAULT_ACTIVITY_RETENTION_MONTHS);
      const tokenDays = this.readCount('REFRESH_TOKEN_CLEANUP_DAYS', DEFAULT_REFRESH_TOKEN_CLEANUP_DAYS);

      const results: CleanupResult[] = [];

      results.push(
        await this.cleanTable(
          'whatsapp_logs',
          waMonths === 0 ? null : whatsappLogs,
          whatsappLogs.id,
          () => lt(whatsappLogs.createdAt, this.monthsAgo(waMonths)),
          'LOG_RETENTION_WHATSAPP_MONTHS=0',
        ),
      );

      results.push(
        await this.cleanTable(
          'activity_logs',
          activityMonths === 0 ? null : activityLogs,
          activityLogs.id,
          () => lt(activityLogs.createdAt, this.monthsAgo(activityMonths)),
          'LOG_RETENTION_ACTIVITY_MONTHS=0',
        ),
      );

      // Token yang dicabut tidak punya kolom "waktu dicabut"; createdAt dipakai
      // sebagai pendekatan. Token yang sudah dicabut memang tidak bisa dipakai
      // lagi (query refresh hanya mencari is_revoked = false), jadi menghapusnya
      // lebih awal dari 1 hari sejak dicabut tidak berdampak apa pun.
      results.push(
        await this.cleanTable(
          'refresh_tokens',
          tokenDays === 0 ? null : refreshTokens,
          refreshTokens.id,
          () =>
            or(
              lt(refreshTokens.expiresAt, this.daysAgo(tokenDays)),
              and(eq(refreshTokens.isRevoked, true), lt(refreshTokens.createdAt, this.daysAgo(tokenDays))),
            ) as SQL,
          'REFRESH_TOKEN_CLEANUP_DAYS=0',
        ),
      );

      const total = results.reduce((n, r) => n + r.deleted, 0);
      this.logger.log(
        `🧹 Pembersihan selesai: ${total} baris dihapus (` +
          results.map((r) => `${r.table}: ${r.error ? 'GAGAL' : r.skipped ? 'dilewati' : r.deleted}`).join(', ') +
          ')',
      );
      return results;
    } finally {
      this.running = false;
    }
  }

  private async cleanTable<T extends MySqlTable>(
    name: string,
    table: T | null,
    idColumn: MySqlColumn,
    condition: () => SQL,
    disabledBy: string,
  ): Promise<CleanupResult> {
    if (!table) return { table: name, deleted: 0, skipped: `dimatikan (${disabledBy})` };

    try {
      const where = condition();
      let deleted = 0;
      for (let batch = 0; batch < CLEANUP_MAX_BATCHES; batch++) {
        // Berurutan dari id terkecil = data tertua dulu.
        const [res] = await this.db
          .delete(table)
          .where(where)
          .orderBy(asc(idColumn))
          .limit(CLEANUP_BATCH_SIZE);
        const n = res?.affectedRows ?? 0;
        deleted += n;
        if (n < CLEANUP_BATCH_SIZE) break;
        if (this.batchPauseMs > 0) await new Promise((r) => setTimeout(r, this.batchPauseMs));
      }
      return { table: name, deleted };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`❌ Pembersihan ${name} gagal: ${message}`);
      return { table: name, deleted: 0, error: message };
    }
  }

  // Angka bulat >= 0 dari pengaturan; nilai aneh jatuh ke bawaan (bukan 0,
  // supaya salah ketik tidak mematikan pembersihan atau menghapus terlalu banyak).
  private readCount(key: string, fallback: number): number {
    return readNonNegativeInt(this.config, key, fallback, this.logger);
  }

  // Angka sudah divalidasi bilangan bulat >= 0 di atas, jadi aman ditulis
  // langsung ke SQL (INTERVAL tidak bisa memakai placeholder di semua versi MySQL).
  private monthsAgo(n: number): SQL {
    return sql`DATE_SUB(NOW(), INTERVAL ${sql.raw(String(n))} MONTH)`;
  }

  private daysAgo(n: number): SQL {
    return sql`DATE_SUB(NOW(), INTERVAL ${sql.raw(String(n))} DAY)`;
  }
}
