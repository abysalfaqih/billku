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

  /**
   * Hasil kirim yang gagal HARUS dilempar sebagai error supaya BullMQ mengulang
   * (attempts + backoff di WhatsAppService). Dulu kegagalan hanya dicatat lalu
   * proses dianggap selesai, jadi pengulangan itu tidak pernah terjadi dan satu
   * gangguan sesaat di provider membuat pengingat/isolir tidak sampai ke pelanggan.
   * Baris log `failed` ditulis HANYA pada percobaan terakhir (satu pesan = satu baris).
   */
  async process(job: Job<WhatsAppJobData>): Promise<void> {
    const { tenantId, phone, message, trigger } = job.data;
    const maxAttempts = job.opts?.attempts ?? 1;
    const isLastAttempt = (job.attemptsMade ?? 0) + 1 >= maxAttempts;

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
      // Bukan gangguan sementara — diulang pun hasilnya sama. Dicatat di log WA
      // supaya admin tahu pesannya tidak terkirim (dulu hanya baris di log server).
      this.logger.warn(`Tenant '${tenantId}' tidak punya konfigurasi WA aktif — pesan tidak dikirim`);
      await this.writeLog(job.data, 'belum-diatur', 'failed', null, 'Tenant belum punya konfigurasi WhatsApp yang aktif');
      return;
    }

    let result: { success: boolean; messageId?: string; error?: string };
    try {
      const adapter = WhatsAppAdapterFactory.create(config);
      result = await adapter.send(phone, message);
    } catch (err) {
      result = { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    if (result.success) {
      await this.writeLog(
        job.data,
        config.provider,
        'sent',
        result.messageId ? JSON.stringify({ messageId: result.messageId }) : null,
        null,
      );
      this.logger.log(`✅ WA [${config.provider}] → ${phone} (${trigger})`);
      return;
    }

    if (!isLastAttempt) {
      this.logger.warn(
        `⚠️ WA [${config.provider}] → ${phone} (${trigger}) gagal, percobaan ${(job.attemptsMade ?? 0) + 1}/${maxAttempts}: ${result.error}`,
      );
      throw new Error(result.error ?? 'Pengiriman WA gagal');
    }

    await this.writeLog(job.data, config.provider, 'failed', null, result.error ?? 'Unknown error');
    this.logger.error(`❌ WA [${config.provider}] → ${phone} gagal setelah ${maxAttempts} percobaan: ${result.error}`);
  }

  // Pesan yang SUDAH terkirim tidak boleh memicu pengiriman ulang hanya karena
  // pencatatan log gagal — makanya error DB di sini hanya dicatat.
  private async writeLog(
    data: WhatsAppJobData,
    provider: string,
    status: 'sent' | 'failed',
    providerResponse: string | null,
    errorMessage: string | null,
  ) {
    try {
      await this.db.insert(whatsappLogs).values({
        tenantId: data.tenantId,
        customerId: data.customerId,
        billId: data.billId,
        trigger: data.trigger,
        phone: data.phone,
        message: data.message,
        provider,
        status,
        providerResponse,
        errorMessage,
        sentAt: status === 'sent' ? new Date() : null,
      });
    } catch (err) {
      this.logger.error(`Gagal menulis log WA (${status}) untuk ${data.phone}: ${err}`);
    }
  }
}
