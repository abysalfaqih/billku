import { mysqlTable, varchar, bigint, boolean, timestamp, index } from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';

export const areas = mysqlTable(
  'areas',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index('areas_tenant_id_idx').on(table.tenantId)],
);

export type Area = typeof areas.$inferSelect;
export type NewArea = typeof areas.$inferInsert;