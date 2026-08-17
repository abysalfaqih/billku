import {
  mysqlTable,
  varchar,
  bigint,
  int,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';

export const mikrotikConfigs = mysqlTable(
  'mikrotik_configs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),

    tenantId: varchar('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id),

    name: varchar('name', { length: 255 }).notNull(), // Nama display, contoh: "Router Utama"

    host: varchar('host', { length: 100 }).notNull(), // IP Mikrotik
    port: int('port').notNull().default(8728),         // Port API (default 8728, SSL 8729)
    username: varchar('username', { length: 100 }).notNull(),
    password: varchar('password', { length: 255 }).notNull(),

    // Secret yang sama dikonfigurasi di Mikrotik → Radius → server secret
    radiusSecret: varchar('radius_secret', { length: 255 }).notNull(),

    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index('mikrotik_configs_tenant_id_idx').on(table.tenantId),
  ],
);

export type MikrotikConfig = typeof mikrotikConfigs.$inferSelect;
export type NewMikrotikConfig = typeof mikrotikConfigs.$inferInsert;