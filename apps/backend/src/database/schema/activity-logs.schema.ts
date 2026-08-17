import {
  mysqlTable,
  varchar,
  bigint,
  int,
  json,
  timestamp,
  index,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';

export const activityLogs = mysqlTable(
  'activity_logs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    tenantId: varchar('tenant_id', { length: 36 }).references(() => tenants.id),
    userId: bigint('user_id', { mode: 'number' }),
    userEmail: varchar('user_email', { length: 255 }),
    method: varchar('method', { length: 10 }).notNull(),
    path: varchar('path', { length: 500 }).notNull(),
    action: varchar('action', { length: 255 }).notNull(),
    // ID resource yang kena aksi, mis. id pelanggan yang dihapus/id paket yang diubah
    targetId: varchar('target_id', { length: 64 }),
    // Snapshot data (body request yang sudah disensor untuk field rahasia)
    // supaya audit log tahu APA yang berubah, bukan cuma endpoint mana yang dipanggil
    metadata: json('metadata'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 }),
    statusCode: int('status_code').notNull(),
    durationMs: int('duration_ms').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('activity_logs_tenant_id_idx').on(table.tenantId),
    index('activity_logs_user_id_idx').on(table.userId),
    index('activity_logs_created_at_idx').on(table.createdAt),
    index('activity_logs_target_id_idx').on(table.targetId),
  ],
);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;