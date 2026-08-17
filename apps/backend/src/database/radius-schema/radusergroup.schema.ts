import { mysqlTable, int, varchar } from 'drizzle-orm/mysql-core';

// Mapping user → group
// Contoh isi:
//   ('pelanggan01', 'basic-10-mbps', 1)
export const radusergroup = mysqlTable('radusergroup', {
  id: int('id', { unsigned: true }).primaryKey().autoincrement(),
  username: varchar('username', { length: 64 }).notNull().default(''),
  groupname: varchar('groupname', { length: 64 }).notNull().default(''),
  priority: int('priority').notNull().default(1),
});