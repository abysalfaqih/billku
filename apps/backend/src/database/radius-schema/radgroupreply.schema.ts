import { mysqlTable, int, varchar } from 'drizzle-orm/mysql-core';

// Atribut reply per group (paket/pool)
// Contoh isi:
//   ('basic-10-mbps', 'Mikrotik-Rate-Limit', ':=', '10M/5M')
export const radgroupreply = mysqlTable('radgroupreply', {
  id: int('id', { unsigned: true }).primaryKey().autoincrement(),
  groupname: varchar('groupname', { length: 64 }).notNull().default(''),
  attribute: varchar('attribute', { length: 64 }).notNull().default(''),
  op: varchar('op', { length: 2 }).notNull().default('='),
  value: varchar('value', { length: 253 }).notNull().default(''),
});