import {
  mysqlTable, varchar, bigint, int, text, boolean, timestamp, date,
  mysqlEnum, decimal, index, uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';
import { packages } from './packages.schema';
import { areas } from './areas.schema';
import { mikrotikConfigs } from './mikrotik-configs.schema';

export const customers = mysqlTable(
  'customers',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),

    // Identitas permanen pelanggan (No. Pelanggan) — format: PEL-YYMMDD-NNN.
    // Nullable karena pelanggan lama (sebelum fitur ini ada) belum punya kode
    // sampai dijalankan script backfill. Unique index tetap aman untuk baris
    // yang masih NULL (MySQL tidak menganggap NULL bentrok dengan NULL lain).
    customerCode: varchar('customer_code', { length: 30 }),

    packageId: bigint('package_id', { mode: 'number' }).references(() => packages.id),
    areaId: bigint('area_id', { mode: 'number' }).references(() => areas.id),

    // Tipe koneksi
    connectionType: mysqlEnum('connection_type', ['pppoe', 'hotspot']).notNull().default('pppoe'),

    // Mikrotik (untuk hotspot — pilihan admin)
    mikrotikConfigId: bigint('mikrotik_config_id', { mode: 'number' }).references(() => mikrotikConfigs.id),

    // Profile hotspot di Mikrotik
    hotspotProfile: varchar('hotspot_profile', { length: 100 }),

    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 20 }).notNull(),
    address: text('address'),
    nik: varchar('nik', { length: 20 }),

    usernamePppoe: varchar('username_pppoe', { length: 100 }),
    passwordPppoe: varchar('password_pppoe', { length: 255 }),
    pppoeProfile: varchar('pppoe_profile', { length: 100 }),
    ipAddress: varchar('ip_address', { length: 45 }),

    billingDate: int('billing_date').notNull(),
    installationDate: date('installation_date'),

    taxEnabled: boolean('tax_enabled').notNull().default(false),
    taxPercent: decimal('tax_percent', { precision: 5, scale: 2 }),

    status: mysqlEnum('status', ['active', 'isolated', 'suspended', 'terminated'])
      .notNull().default('active'),

    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index('customers_tenant_id_idx').on(table.tenantId),
    index('customers_status_idx').on(table.status),
    index('customers_billing_date_idx').on(table.billingDate),
    index('customers_area_id_idx').on(table.areaId),
    index('customers_connection_type_idx').on(table.connectionType),
    // GLOBAL (bukan per-tenant) — sengaja begini. Tabel RADIUS (radcheck dkk)
    // cuma kenal 'username', tidak tahu konsep tenant. Kalau 2 tenant beda
    // punya username PPPoE sama, entri RADIUS-nya akan tabrakan/saling
    // menimpa — misal hapus pelanggan tenant A bisa ikut memutus pelanggan
    // tenant B yang usernamenya sama. Makanya harus unik se-platform.
    uniqueIndex('customers_pppoe_unique').on(table.usernamePppoe),
    uniqueIndex('customers_code_tenant_unique').on(table.tenantId, table.customerCode),
  ],
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;