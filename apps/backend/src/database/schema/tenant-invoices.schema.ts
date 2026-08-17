import {
  mysqlTable, bigint, varchar, text, decimal, timestamp,
  mysqlEnum, int, uniqueIndex, index,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';

export const tenantInvoices = mysqlTable('tenant_invoices', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),

  // FK ke tenant yang ditagih
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),

  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  invoiceDate:   timestamp('invoice_date').notNull(),
  periodMonth:   int('period_month').notNull(), // 1-12
  periodYear:    int('period_year').notNull(),

  // Items (JSON array)
  // [{ description, qty, unitPrice, discPercent, tax: 'P'|'N' }]
  items: text('items').notNull(),

  subtotal:        decimal('subtotal', { precision: 15, scale: 2 }).notNull(),
  discountAmount:  decimal('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  ppnPercent:      decimal('ppn_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  ppnAmount:       decimal('ppn_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  totalAmount:     decimal('total_amount', { precision: 15, scale: 2 }).notNull(),

  paymentDescription: text('payment_description'),
  authorizedBy:       varchar('authorized_by', { length: 255 }),
  authorizedTitle:    varchar('authorized_title', { length: 100 }),

  status: mysqlEnum('status', ['draft', 'sent', 'paid']).notNull().default('draft'),
  notes: text('notes'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex('tenant_invoices_number_unique').on(table.invoiceNumber),
  index('tenant_invoices_tenant_id_idx').on(table.tenantId),
  index('tenant_invoices_period_idx').on(table.periodYear, table.periodMonth),
]);

export type TenantInvoice = typeof tenantInvoices.$inferSelect;