import {
  mysqlTable,
  varchar,
  bigint,
  int,
  text,
  boolean,
  timestamp,
  decimal,
  index,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';
import { ipPools } from './ip-pools.schema';

export const packages = mysqlTable(
  'packages',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),

    tenantId: varchar('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id),

    // IP Pool yang dipakai paket ini → menentukan Mikrotik & grup FreeRADIUS
    ipPoolId: bigint('ip_pool_id', { mode: 'number' })
      .references(() => ipPools.id),

    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    speedDownload: int('speed_download').notNull(),
    speedUpload: int('speed_upload').notNull(),
    price: decimal('price', { precision: 15, scale: 2 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index('packages_tenant_id_idx').on(table.tenantId),
  ],
);

export type Package = typeof packages.$inferSelect;
export type NewPackage = typeof packages.$inferInsert;