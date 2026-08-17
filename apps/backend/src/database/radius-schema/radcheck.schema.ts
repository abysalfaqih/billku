import { mysqlTable, int, varchar } from 'drizzle-orm/mysql-core';

// Tabel autentikasi per-user
// Contoh isi:
//   ('pelanggan01', 'Cleartext-Password', ':=', 'password123')
//   ('pelanggan01', 'Auth-Type', ':=', 'Reject') ← saat isolir
export const radcheck = mysqlTable('radcheck', {
  id: int('id', { unsigned: true }).primaryKey().autoincrement(),
  username: varchar('username', { length: 64 }).notNull().default(''),
  attribute: varchar('attribute', { length: 64 }).notNull().default(''),
  op: varchar('op', { length: 2 }).notNull().default('=='),
  value: varchar('value', { length: 253 }).notNull().default(''),
});