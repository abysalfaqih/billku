import { mysqlTable, int, varchar } from 'drizzle-orm/mysql-core';

// Atribut reply per-user (rate limit individual)
// Contoh: ('pelanggan01', 'Mikrotik-Rate-Limit', ':=', '10M/5M')
export const radreply = mysqlTable('radreply', {
  id: int('id', { unsigned: true }).primaryKey().autoincrement(),
  username: varchar('username', { length: 64 }).notNull().default(''),
  attribute: varchar('attribute', { length: 64 }).notNull().default(''),
  op: varchar('op', { length: 2 }).notNull().default('='),
  value: varchar('value', { length: 253 }).notNull().default(''),
});