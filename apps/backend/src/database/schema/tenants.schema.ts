import {
  mysqlTable, varchar, text, boolean, timestamp, uniqueIndex, decimal,
} from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';

export const tenants = mysqlTable(
  'tenants',
  {
    id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    address: text('address'),
    logoUrl: varchar('logo_url', { length: 500 }),
    faviconUrl: varchar('favicon_url', { length: 500 }),
    motto: varchar('motto', { length: 255 }),
    about: text('about'),
    bandwidthEnabled: boolean('bandwidth_enabled').notNull().default(false),
    bandwidthDescription: varchar('bandwidth_description', { length: 255 }),
    bandwidthPriceMonthly: decimal('bandwidth_price_monthly', {
      precision: 15,
      scale: 2,
      mode: 'number',
    }),
    bankAccounts: text('bank_accounts'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex('tenants_slug_unique').on(table.slug)],
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;