import {
  mysqlTable,
  varchar,
  bigint,
  text,
  timestamp,
  mysqlEnum,
  decimal,
  index,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';
import { bills } from './bills.schema';
import { customers } from './customers.schema';
import { users } from './users.schema';

export const payments = mysqlTable(
  'payments',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),

    tenantId: varchar('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id),

    billId: bigint('bill_id', { mode: 'number' })
      .notNull()
      .references(() => bills.id),

    // Denormalized dari bills — untuk query laporan tanpa selalu JOIN ke bills
    customerId: bigint('customer_id', { mode: 'number' })
      .notNull()
      .references(() => customers.id),

    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),

    paymentMethod: mysqlEnum('payment_method', ['cash', 'transfer', 'other'])
      .notNull()
      .default('cash'),

    paidAt: timestamp('paid_at').notNull().defaultNow(),
    notes: text('notes'),

    // Admin yang mencatat pembayaran — penting untuk audit.
    // Nullable + SET NULL: kalau user-nya suatu saat dihapus, riwayat
    // pembayaran TETAP ada (cuma "dicatat oleh"-nya jadi kosong), bukan ikut
    // terhapus atau memblokir penghapusan user.
    createdBy: bigint('created_by', { mode: 'number' })
      .references(() => users.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('payments_tenant_id_idx').on(table.tenantId),
    index('payments_bill_id_idx').on(table.billId),
    index('payments_customer_id_idx').on(table.customerId),
    // Untuk laporan pendapatan berdasarkan waktu
    index('payments_paid_at_idx').on(table.paidAt),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;