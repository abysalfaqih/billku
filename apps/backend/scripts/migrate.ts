/**
 * Script migrasi mandiri untuk billku/apps/backend.
 * Menjalankan migrasi lewat drizzle-orm langsung (BUKAN lewat CLI "drizzle-kit migrate"),
 * supaya pesan sukses/gagal SELALU tercetak jelas sebagai teks biasa —
 * tidak bergantung pada dukungan ANSI/spinner terminal (yang sering "hilang"
 * di PowerShell lama, sesi SSH tanpa TTY penuh, dsb).
 *
 * Cara pakai (dari folder apps/backend):
 *   npx tsx scripts/migrate.ts
 *
 * Atau jadikan default lewat package.json:
 *   "db:migrate": "tsx scripts/migrate.ts"
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';

async function main() {
  const required = ['DB_HOST', 'DB_USER', 'DB_NAME'] as const;
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(
      `[migrate] .env tidak lengkap. Variabel kosong/tidak ditemukan: ${missing.join(', ')}`,
    );
    console.error(
      '[migrate] Pastikan file .env ada di folder apps/backend (bukan di root repo) dan berisi DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.',
    );
    process.exit(1);
  }

  console.log('[migrate] Menyambung ke database...', {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
  });

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME,
  });

  const db = drizzle(connection);

  try {
    console.log('[migrate] Menjalankan migrasi dari ./src/database/migrations ...');
    await migrate(db, { migrationsFolder: './src/database/migrations' });
    console.log('[migrate] ✅ Migrasi berhasil diterapkan.');
  } catch (err: any) {
    console.error('[migrate] ❌ Migrasi GAGAL. Detail error asli:');
    console.error(err?.message ?? err);
    if (err?.cause?.sqlMessage) {
      console.error('[migrate] Pesan dari database:', err.cause.sqlMessage);
    }
    if (err?.cause?.code === 'ER_TABLE_EXISTS_ERROR') {
      console.error(
        '[migrate] → Tabel sudah ada di database. Kemungkinan besar schema pernah dibuat lewat "drizzle-kit push" atau migrasi sebelumnya sempat gagal di tengah jalan.',
      );
      console.error(
        '[migrate]   Kalau ini masih tahap development (belum ada data penting), solusi tercepat: DROP lalu CREATE ulang database, baru jalankan migrate ini lagi dari nol.',
      );
    }
    if (err?.code === 'ECONNREFUSED') {
      console.error(
        '[migrate] → Koneksi ke database ditolak. Cek apakah service MySQL/MariaDB sudah jalan, dan apakah DB_HOST/DB_PORT sudah benar.',
      );
    }
    if (err?.cause?.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(
        '[migrate] → Username/password database salah, atau user tidak punya akses ke database tersebut.',
      );
    }
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('[migrate] Terjadi error tak terduga:', err);
  process.exit(1);
});
