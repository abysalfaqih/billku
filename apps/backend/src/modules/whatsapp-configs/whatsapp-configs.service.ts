import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { whatsappConfigs } from '../../database/schema';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { CreateWhatsappConfigDto } from './dto/create-whatsapp-config.dto';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class WhatsappConfigsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private whatsappService: WhatsAppService,
    private subscriptionService: SubscriptionService,
  ) {}

  async create(dto: CreateWhatsappConfigDto, user: AuthUser) {
    await this.subscriptionService.checkWhatsappFeature(user.tenantId);
    
    const [result] = await this.db.insert(whatsappConfigs).values({
      tenantId: user.tenantId,
      provider: dto.provider,
      name: dto.name,
      apiKey: dto.apiKey,
      senderNumber: dto.senderNumber,
      extraConfig: dto.extraConfig,
    });

    return this.findOne(Number(result.insertId), user);
  }

  async findAll(user: AuthUser) {
    return this.db
      .select()
      .from(whatsappConfigs)
      .where(eq(whatsappConfigs.tenantId, user.tenantId));
  }

  async findOne(id: number, user: AuthUser) {
    const [config] = await this.db
      .select()
      .from(whatsappConfigs)
      .where(
        and(
          eq(whatsappConfigs.id, id),
          eq(whatsappConfigs.tenantId, user.tenantId),
        ),
      )
      .limit(1);

    if (!config) throw new NotFoundException('Konfigurasi WA tidak ditemukan');
    return config;
  }

  // Test kirim pesan ke nomor admin
  async testSend(id: number, user: AuthUser) {
    const config = await this.findOne(id, user);

    await this.whatsappService.queueNotification({
      tenantId: user.tenantId,
      phone: config.senderNumber,
      message: `✅ Test notifikasi dari Billku Tenjo berhasil!\nProvider: ${config.provider}`,
      trigger: 'registration',
    });

    return { message: 'Pesan test sedang dikirim, cek log WA Anda.' };
  }

  async remove(id: number, user: AuthUser) {
    await this.findOne(id, user);

    await this.db
      .delete(whatsappConfigs)
      .where(
        and(
          eq(whatsappConfigs.id, id),
          eq(whatsappConfigs.tenantId, user.tenantId),
        ),
      );

    return { message: 'Konfigurasi WA berhasil dihapus' };
  }
}