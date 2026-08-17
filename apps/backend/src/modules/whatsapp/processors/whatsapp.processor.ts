import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleClient } from '../../../database/database.module';
import { whatsappConfigs, whatsappLogs } from '../../../database/schema';
import { WhatsAppAdapterFactory } from '../adapters/whatsapp-adapter.factory';
import type { WhatsAppJobData } from '../whatsapp-job.interface';

@Processor('whatsapp')
export class WhatsAppProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {
    super();
  }

  async process(job: Job<WhatsAppJobData>): Promise<void> {
    const { tenantId, phone, message, trigger, customerId, billId } = job.data;

    // Cari konfigurasi WA aktif milik tenant ini
    const [config] = await this.db
      .select()
      .from(whatsappConfigs)
      .where(
        and(
          eq(whatsappConfigs.tenantId, tenantId),
          eq(whatsappConfigs.isActive, true),
        ),
      )
      .limit(1);

    if (!config) {
      this.logger.warn(
        `Tenant '${tenantId}' tidak punya konfigurasi WA aktif — skip`,
      );
      return;
    }

    // Buat adapter sesuai provider
    const adapter = WhatsAppAdapterFactory.create(config);

    // Kirim pesan
    const result = await adapter.send(phone, message);

    // Catat ke log
    await this.db.insert(whatsappLogs).values({
      tenantId,
      customerId,
      billId,
      trigger,
      phone,
      message,
      provider: config.provider,
      status: result.success ? 'sent' : 'failed',
      providerResponse: result.messageId
        ? JSON.stringify({ messageId: result.messageId })
        : null,
      errorMessage: result.error ?? null,
      sentAt: result.success ? new Date() : null,
    });

    if (result.success) {
      this.logger.log(
        `✅ WA [${config.provider}] → ${phone} (${trigger})`,
      );
    } else {
      this.logger.error(
        `❌ WA [${config.provider}] → ${phone} gagal: ${result.error}`,
      );
    }
  }
}