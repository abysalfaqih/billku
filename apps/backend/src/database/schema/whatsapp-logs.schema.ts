import {
  mysqlTable,
  varchar,
  bigint,
  text,
  timestamp,
  mysqlEnum,
  index,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';
import { customers } from './customers.schema';
import { bills } from './bills.schema';

export const whatsappLogs = mysqlTable(
  'whatsapp_logs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),

    tenantId: varchar('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id),

    customerId: bigint('customer_id', { mode: 'number' })
      .references(() => customers.id),

    billId: bigint('bill_id', { mode: 'number' })
      .references(() => bills.id),

    trigger: mysqlEnum('trigger', [
      'registration',
      'reminder',
      'isolir',
      'payment',
    ]).notNull(),

    phone: varchar('phone', { length: 20 }).notNull(),
    message: text('message').notNull(),

    provider: varchar('provider', { length: 50 }).notNull(),

    status: mysqlEnum('status', ['pending', 'sent', 'failed'])
      .notNull()
      .default('pending'),

    providerResponse: text('provider_response'),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('whatsapp_logs_tenant_id_idx').on(table.tenantId),
    index('whatsapp_logs_trigger_idx').on(table.trigger),
    index('whatsapp_logs_status_idx').on(table.status),
  ],
);

export type WhatsappLog = typeof whatsappLogs.$inferSelect;
export type NewWhatsappLog = typeof whatsappLogs.$inferInsert;