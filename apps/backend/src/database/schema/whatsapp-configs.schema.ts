import {
  mysqlTable,
  varchar,
  bigint,
  boolean,
  timestamp,
  text,
  mysqlEnum,
  index,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';

export const whatsappConfigs = mysqlTable(
  'whatsapp_configs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),

    tenantId: varchar('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id),

    provider: mysqlEnum('provider', ['fonnte', 'wablast', 'meta']).notNull(),

    name: varchar('name', { length: 255 }).notNull(),

    // API Key / Token utama
    apiKey: varchar('api_key', { length: 500 }).notNull(),

    // Nomor WA pengirim
    senderNumber: varchar('sender_number', { length: 20 }).notNull(),

    // Config tambahan per provider (JSON string)
    // Meta: { "phone_number_id": "xxx" }
    // WA Blast: { "secret_key": "xxx", "server": "solo" } — server = subdomain akun Wablas
    // Fonnte: null
    extraConfig: text('extra_config'),

    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index('whatsapp_configs_tenant_id_idx').on(table.tenantId),
  ],
);

export type WhatsappConfig = typeof whatsappConfigs.$inferSelect;
export type NewWhatsappConfig = typeof whatsappConfigs.$inferInsert;