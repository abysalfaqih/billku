import {
  mysqlTable,
  varchar,
  bigint,
  text,
  timestamp,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { tenants } from './tenants.schema';

// Satu baris = satu template custom milik satu tenant untuk satu trigger.
// Kalau tenant belum pernah menyimpan override untuk trigger tertentu,
// berarti tenant itu masih pakai template default (lihat whatsapp-templates.defaults.ts).
export const whatsappTemplates = mysqlTable(
  'whatsapp_templates',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),

    tenantId: varchar('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id),

    type: mysqlEnum('type', [
      'registration',
      'reminder',
      'isolir',
      'payment',
    ]).notNull(),

    // Isi template dengan placeholder {{namaVariabel}}, contoh: "Halo {{name}}"
    content: text('content').notNull(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index('whatsapp_templates_tenant_id_idx').on(table.tenantId),
    // Maksimal 1 custom template per tenant per trigger
    uniqueIndex('whatsapp_templates_tenant_type_unique').on(
      table.tenantId,
      table.type,
    ),
  ],
);

export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;
export type NewWhatsappTemplate = typeof whatsappTemplates.$inferInsert;
