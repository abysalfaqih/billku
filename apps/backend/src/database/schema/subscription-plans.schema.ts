import {
  mysqlTable, bigint, varchar, text, decimal, int, boolean, timestamp,
} from 'drizzle-orm/mysql-core';

export const subscriptionPlans = mysqlTable('subscription_plans', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  priceMonthly: decimal('price_monthly', { precision: 15, scale: 2 }).notNull(),
  maxCustomers: int('max_customers').notNull().default(100),
  maxMikrotik: int('max_mikrotik').notNull().default(1),
  maxIpPools: int('max_ip_pools').notNull().default(5),
  maxUsers: int('max_users').notNull().default(2),
  hasWhatsapp: boolean('has_whatsapp').notNull().default(false),
  hasApiAccess: boolean('has_api_access').notNull().default(false),
  hasReports: boolean('has_reports').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  extraFeatures: text('extra_features'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;