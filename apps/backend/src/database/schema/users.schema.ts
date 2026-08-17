import {
  mysqlTable,
  varchar,
  bigint,
  boolean,
  timestamp,
  mysqlEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';

export const users = mysqlTable(
  'users',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),

    tenantId: varchar('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id),

    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),

    // Selalu simpan password dalam bentuk hash, TIDAK PERNAH plain text
    password: varchar('password', { length: 255 }).notNull(),

    // super_admin → level Tenjo Hotspot (pemilik platform)
    // admin       → level tenant, akses penuh
    // staff       → level tenant, akses terbatas
    role: mysqlEnum('role', ['super_admin', 'admin', 'staff'])
      .notNull()
      .default('staff'),

    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    // Email unik per tenant, bukan global
    // Artinya email yang sama boleh ada di tenant berbeda
    uniqueIndex('users_email_tenant_unique').on(table.tenantId, table.email),

    // Index untuk query berdasarkan tenant (akan sering dipakai)
    index('users_tenant_id_idx').on(table.tenantId),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;