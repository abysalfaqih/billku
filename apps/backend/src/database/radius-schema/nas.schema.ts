import { mysqlTable, int, varchar } from 'drizzle-orm/mysql-core';

// Daftar NAS (Mikrotik router) yang boleh auth ke FreeRADIUS
export const nas = mysqlTable('nas', {
  id: int('id').primaryKey().autoincrement(),
  nasname: varchar('nasname', { length: 128 }).notNull(),    // IP Mikrotik
  shortname: varchar('shortname', { length: 32 }),
  type: varchar('type', { length: 30 }).default('other'),
  ports: int('ports'),
  secret: varchar('secret', { length: 60 }).notNull(),       // RADIUS secret
  server: varchar('server', { length: 64 }),
  community: varchar('community', { length: 50 }),
  description: varchar('description', { length: 200 }).default('RADIUS Client'),
});