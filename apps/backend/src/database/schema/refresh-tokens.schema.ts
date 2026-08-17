import {
  mysqlTable,
  varchar,
  bigint,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/mysql-core';
import { users } from './users.schema';
import { tenants } from './tenants.schema';

export const refreshTokens = mysqlTable(
  'refresh_tokens',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),

    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Disimpan di sini agar query isolasi tenant tetap konsisten
    tenantId: varchar('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id),

    // TIDAK simpan token asli — simpan hash-nya saja (keamanan)
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),

    expiresAt: timestamp('expires_at').notNull(),
    isRevoked: boolean('is_revoked').notNull().default(false),

    // Untuk audit & keamanan
    ipAddress: varchar('ip_address', { length: 45 }), // IPv6 max 45 karakter
    userAgent: varchar('user_agent', { length: 500 }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('refresh_tokens_user_id_idx').on(table.userId),
    index('refresh_tokens_tenant_id_idx').on(table.tenantId),
  ],
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;