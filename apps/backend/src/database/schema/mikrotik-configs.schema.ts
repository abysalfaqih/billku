import {
  mysqlTable,
  varchar,
  bigint,
  int,
  boolean,
  timestamp,
  index,
  mysqlEnum,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';

// Peran router. 'both' = melayani PPPoE sekaligus Hotspot (default, sama seperti
// perilaku sebelum kolom ini ada — jadi router lama tidak berubah sampai admin
// mengaturnya sendiri).
export const ROUTER_ROLES = ['pppoe', 'hotspot', 'both'] as const;
export type RouterRole = (typeof ROUTER_ROLES)[number];

export const routerServesPppoe = (role: RouterRole) => role === 'pppoe' || role === 'both';
export const routerServesHotspot = (role: RouterRole) => role === 'hotspot' || role === 'both';

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

    // Router ini dipakai untuk apa: PPPoE, Hotspot, atau keduanya.
    role: mysqlEnum('role', ROUTER_ROLES).notNull().default('both'),

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