import {
  mysqlTable,
  varchar,
  bigint,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';
import { mikrotikConfigs } from './mikrotik-configs.schema';

export const ipPools = mysqlTable(
  'ip_pools',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),

    tenantId: varchar('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id),

    // IP Pool ini ada di Mikrotik mana
    mikrotikConfigId: bigint('mikrotik_config_id', { mode: 'number' })
      .notNull()
      .references(() => mikrotikConfigs.id),

    // Nama tampilan — contoh: "Pool Basic 10 Mbps"
    displayName: varchar('display_name', { length: 255 }).notNull(),

    // Nama teknis — dipakai di Mikrotik & FreeRADIUS
    // Hanya huruf kecil, angka, strip — contoh: "basic-10-mbps"
    name: varchar('name', { length: 100 }).notNull(),

    // Network config
    network: varchar('network', { length: 20 }).notNull(),  // 192.168.10.0/24
    gateway: varchar('gateway', { length: 45 }).notNull(),  // 192.168.10.1
    ipStart: varchar('ip_start', { length: 45 }).notNull(), // 192.168.10.2
    ipEnd: varchar('ip_end', { length: 45 }).notNull(),     // 192.168.10.254

    dnsPrimary: varchar('dns_primary', { length: 45 }).notNull().default('8.8.8.8'),
    dnsSecondary: varchar('dns_secondary', { length: 45 }).notNull().default('8.8.4.4'),

    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index('ip_pools_tenant_id_idx').on(table.tenantId),
    index('ip_pools_mikrotik_config_id_idx').on(table.mikrotikConfigId),
  ],
);

export type IpPool = typeof ipPools.$inferSelect;
export type NewIpPool = typeof ipPools.$inferInsert;