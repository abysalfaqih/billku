/**
 * Backfill "No. Pelanggan" (customerCode) untuk pelanggan LAMA yang dibuat
 * sebelum fitur ini ada (customer_code masih NULL).
 *
 * Kode dibuat berdasarkan tanggal instalasi/daftar ASLI tiap pelanggan
 * (installationDate, atau createdAt kalau installationDate kosong) — jadi
 * kodenya mencerminkan riwayat sungguhan, bukan tanggal hari ini.
 *
 * Aman dijalankan berkali-kali: pelanggan yang sudah punya kode (tidak NULL)
 * otomatis dilewati.
 *
 * Cara pakai (dari folder apps/backend):
 *   npx tsx scripts/backfill-customer-codes.ts
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { isNull, asc, eq } from 'drizzle-orm';
import { customers } from '../src/database/schema';

function dateKeyOf(d: Date): string {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME,
  });
  const db = drizzle(connection);

  const pending = await db
    .select({
      id: customers.id,
      tenantId: customers.tenantId,
      installationDate: customers.installationDate,
      createdAt: customers.createdAt,
      name: customers.name,
    })
    .from(customers)
    .where(isNull(customers.customerCode))
    .orderBy(asc(customers.tenantId), asc(customers.createdAt), asc(customers.id));

  if (pending.length === 0) {
    console.log('[backfill] Tidak ada pelanggan yang perlu di-backfill. Selesai.');
    await connection.end();
    return;
  }

  console.log(`[backfill] Ditemukan ${pending.length} pelanggan tanpa kode.`);

  // urutkan per tenant, lalu per tanggal asli (installationDate > createdAt), stabil oleh id
  pending.sort((a, b) => {
    if (a.tenantId !== b.tenantId) return a.tenantId < b.tenantId ? -1 : 1;
    const da = new Date(a.installationDate ?? a.createdAt).getTime();
    const db_ = new Date(b.installationDate ?? b.createdAt).getTime();
    if (da !== db_) return da - db_;
    return a.id - b.id;
  });

  // counter di memori: key = `${tenantId}:${dateKey}`
  const counters = new Map<string, number>();
  let updated = 0;

  for (const c of pending) {
    const baseDate = new Date(c.installationDate ?? c.createdAt);
    const dateKey = dateKeyOf(baseDate);
    const counterKey = `${c.tenantId}:${dateKey}`;
    const nextSeq = (counters.get(counterKey) ?? 0) + 1;
    counters.set(counterKey, nextSeq);

    const code = `${dateKey}${String(nextSeq).padStart(3, '0')}`;
    await db.update(customers).set({ customerCode: code }).where(eq(customers.id, c.id));
    console.log(`[backfill] #${c.id} ${c.name} → ${code}`);
    updated++;
  }

  console.log(`[backfill] Selesai. ${updated} pelanggan diberi kode baru.`);
  await connection.end();
}

main().catch((err) => {
  console.error('[backfill] Gagal:', err);
  process.exit(1);
});
