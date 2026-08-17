import {
  mysqlTable, varchar, bigint, text, timestamp, date,
  mysqlEnum, decimal, index, uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';
import { customers } from './customers.schema';

export const bills = mysqlTable(
  'bills',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
    customerId: bigint('customer_id', { mode: 'number' }).notNull().references(() => customers.id),

    billNumber: varchar('bill_number', { length: 50 }).notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    dueDate: date('due_date').notNull(),

    // amount = harga paket asli (sebelum PPN)
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    taxPercent: decimal('tax_percent', { precision: 5, scale: 2 }),
    taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    // totalAmount = amount + taxAmount — ini yang ditagih & dicatat sebagai pendapatan
    totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),

    packageName: varchar('package_name', { length: 255 }).notNull(),
    status: mysqlEnum('status', ['unpaid', 'paid', 'overdue', 'cancelled']).notNull().default('unpaid'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex('bills_number_tenant_unique').on(table.tenantId, table.billNumber),
    index('bills_tenant_id_idx').on(table.tenantId),
    index('bills_customer_id_idx').on(table.customerId),
    index('bills_status_idx').on(table.status),
    index('bills_due_date_idx').on(table.dueDate),
  ],
);

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;