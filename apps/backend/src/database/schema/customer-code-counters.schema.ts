import { mysqlTable, varchar, int, primaryKey } from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';

/**
 * Tabel bantu (bukan data bisnis) — cuma menyimpan "urutan terakhir" kode
 * pelanggan per tenant per hari. Dipakai lewat INSERT ... ON DUPLICATE KEY
 * UPDATE supaya penambahan angkanya atomik di level database (aman dipakai
 * bersamaan oleh banyak request sekaligus, tanpa risiko duplikat).
 */
export const customerCodeCounters = mysqlTable(
  'customer_code_counters',
  {
    tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
    dateKey: varchar('date_key', { length: 6 }).notNull(), // format YYMMDD
    lastSeq: int('last_seq').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.dateKey] })],
);

export type CustomerCodeCounter = typeof customerCodeCounters.$inferSelect;
