import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { whatsappTemplates } from '../../database/schema';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_TYPES,
  TEMPLATE_LABELS,
  TEMPLATE_VARIABLES,
  renderTemplate,
  type WhatsappTemplateType,
} from './whatsapp-templates.defaults';

@Injectable()
export class WhatsappTemplatesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  private assertValidType(type: string): asserts type is WhatsappTemplateType {
    if (!TEMPLATE_TYPES.includes(type as WhatsappTemplateType)) {
      throw new BadRequestException(
        `Tipe template '${type}' tidak dikenali. Tipe yang valid: ${TEMPLATE_TYPES.join(', ')}`,
      );
    }
  }

  // Daftar semua trigger + isi aktifnya saat ini (custom kalau tenant sudah pernah
  // menyimpan override, default kalau belum).
  async findAll(user: AuthUser) {
    const overrides = await this.db
      .select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.tenantId, user.tenantId));

    const overrideMap = new Map(overrides.map((o) => [o.type, o]));

    return TEMPLATE_TYPES.map((type) => {
      const override = overrideMap.get(type);
      return {
        type,
        label: TEMPLATE_LABELS[type],
        variables: TEMPLATE_VARIABLES[type],
        content: override?.content ?? DEFAULT_TEMPLATES[type],
        defaultContent: DEFAULT_TEMPLATES[type],
        isCustom: !!override,
        updatedAt: override?.updatedAt ?? null,
      };
    });
  }

  async findOne(type: string, user: AuthUser) {
    this.assertValidType(type);
    const all = await this.findAll(user);
    return all.find((t) => t.type === type)!;
  }

  // Simpan / update template custom milik tenant (upsert per tenant+type)
  async upsert(type: string, content: string, user: AuthUser) {
    this.assertValidType(type);

    const trimmed = content.trim();
    if (!trimmed) {
      throw new BadRequestException('Isi template tidak boleh kosong');
    }

    const [existing] = await this.db
      .select({ id: whatsappTemplates.id })
      .from(whatsappTemplates)
      .where(
        and(
          eq(whatsappTemplates.tenantId, user.tenantId),
          eq(whatsappTemplates.type, type),
        ),
      )
      .limit(1);

    if (existing) {
      await this.db
        .update(whatsappTemplates)
        .set({ content: trimmed, updatedAt: new Date() })
        .where(eq(whatsappTemplates.id, existing.id));
    } else {
      await this.db.insert(whatsappTemplates).values({
        tenantId: user.tenantId,
        type,
        content: trimmed,
      });
    }

    return this.findOne(type, user);
  }

  // Hapus override tenant → otomatis balik pakai default lagi
  async reset(type: string, user: AuthUser) {
    this.assertValidType(type);

    await this.db
      .delete(whatsappTemplates)
      .where(
        and(
          eq(whatsappTemplates.tenantId, user.tenantId),
          eq(whatsappTemplates.type, type),
        ),
      );

    return this.findOne(type, user);
  }

  // Dipakai modul lain (customers, payments, scheduler) untuk mengambil pesan
  // siap-kirim: custom template tenant kalau ada, default kalau belum ada.
  async render(
    type: WhatsappTemplateType,
    tenantId: string,
    data: Record<string, string>,
  ): Promise<string> {
    const [override] = await this.db
      .select({ content: whatsappTemplates.content })
      .from(whatsappTemplates)
      .where(
        and(
          eq(whatsappTemplates.tenantId, tenantId),
          eq(whatsappTemplates.type, type),
        ),
      )
      .limit(1);

    const content = override?.content ?? DEFAULT_TEMPLATES[type];
    return renderTemplate(content, data);
  }
}
