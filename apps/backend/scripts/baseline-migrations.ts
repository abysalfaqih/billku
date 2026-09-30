/**
 * HANYA dipakai SEKALI, saat database sudah punya semua tabel (misal: hasil
 * import dump dari phpMyAdmin/production) tapi belum punya riwayat migrasi
 * drizzle (tabel __drizzle_migrations belum ada / belum lengkap).
 *
 * Script ini MENANDAI migrasi yang ada di folder ./src/database/migrations
 * sebagai "sudah diterapkan" — TANPA menjalankan ulang SQL CREATE TABLE-nya.
 * Jadi aman dipakai di database yang sudah berisi data.
 *
 * Setelah script ini selesai, baru jalankan migrate seperti biasa
 * (npm run db:migrate) untuk memastikan semuanya sinkron.
 *
 * Cara pakai (dari folder apps/backend):
 *   npx tsx scripts/baseline-migrations.ts
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

const MIGRATIONS_FOLDER = path.resolve(__dirname, '..', 'src', 'database', 'migrations');

async function main() {
  const journalPath = path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json');
  if (!fs.existsSync(journalPath)) {
    console.error(`[baseline] Tidak ketemu ${journalPath}`);
    process.exit(1);
  }
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME,
  });

  console.log(`[baseline] Terhubung ke database "${process.env.DB_NAME}".`);

  // Buat tabel riwayat migrasi kalau belum ada (skema sama persis dengan yang dipakai drizzle-kit)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`__drizzle_migrations\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`hash\` text NOT NULL,
      \`created_at\` bigint,
      PRIMARY KEY (\`id\`)
    )
  `);

  const [existingRows] = await connection.query('SELECT hash FROM `__drizzle_migrations`');
  const existingHashes = new Set((existingRows as { hash: string }[]).map((r) => r.hash));

  let inserted = 0;
  for (const entry of journal.entries as { tag: string; when: number }[]) {
    const sqlPath = path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`);
    const query = fs.readFileSync(sqlPath, 'utf8');
    const hash = crypto.createHash('sha256').update(query).digest('hex');

    if (existingHashes.has(hash)) {
      console.log(`[baseline] Lewati (sudah tercatat): ${entry.tag}`);
      continue;
    }
    await connection.query(
      'INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES (?, ?)',
      [hash, entry.when],
    );
    console.log(`[baseline] Ditandai sudah diterapkan: ${entry.tag}`);
    inserted++;
  }

  console.log(`[baseline] Selesai. ${inserted} migrasi baru ditandai sebagai sudah diterapkan.`);
  console.log('[baseline] Sekarang jalankan "npm run db:migrate" lagi untuk memverifikasi.');
  await connection.end();
}

main().catch((err) => {
  console.error('[baseline] Gagal:', err);
  process.exit(1);
});
