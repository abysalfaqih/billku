import {
  mysqlTable,
  varchar,
  bigint,
  int,
  text,
  timestamp,
  datetime,      // ← tambahkan import ini
  decimal,
  mysqlEnum,
  index,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';
import { subscriptionPlans } from './subscription-plans.schema';
import { users } from './users.schema';

export const tenantSubscriptions = mysqlTable(
  'tenant_subscriptions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    tenantId: varchar('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id),
    planId: bigint('plan_id', { mode: 'number' })
      .notNull()
      .references(() => subscriptionPlans.id),
    status: mysqlEnum('status', ['active', 'expired', 'trial', 'cancelled'])
      .notNull()
      .default('trial'),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    expiresAt: datetime('expires_at').notNull(),   // ← ganti timestamp → datetime
    durationMonths: int('duration_months').notNull().default(1),
    amountPaid: decimal('amount_paid', { precision: 15, scale: 2 }).notNull().default('0'),
    notes: text('notes'),
    createdBy: bigint('created_by', { mode: 'number' })
      .references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index('tenant_subscriptions_tenant_id_idx').on(table.tenantId),
    index('tenant_subscriptions_status_idx').on(table.status),
    index('tenant_subscriptions_expires_at_idx').on(table.expiresAt),
  ],
);

export type TenantSubscription = typeof tenantSubscriptions.$inferSelect;
export type NewTenantSubscription = typeof tenantSubscriptions.$inferInsert;