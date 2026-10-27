import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { whatsappLogs } from '../../database/schema';
import type { WhatsAppJobData } from './whatsapp-job.interface';

// Mengantre pesan harus cepat gagal kalau Redis tidak terjangkau. Tanpa batas
// waktu, `queue.add` menunggu sampai Redis hidup lagi — dan karena scheduler
// menunggu setiap pesan, satu gangguan Redis membuat seluruh proses isolir malam
// itu macet di tengah jalan (pelanggan sisanya tidak pernah diproses).
export const QUEUE_ADD_TIMEOUT_MS = 8000;

// Percobaan kirim ulang oleh antrean bila provider WA sedang bermasalah:
// jeda 1, 2, 4, 8 menit (sekitar 15 menit semuanya).
export const WA_SEND_ATTEMPTS = 5;
export const WA_RETRY_BASE_DELAY_MS = 60_000;

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    @InjectQueue('whatsapp') private whatsappQueue: Queue<WhatsAppJobData>,
    @Inject(DRIZZLE) private db: DrizzleClient,
  ) {}

  /**
   * Antre satu pesan WA. Tidak pernah melempar error (gagal antre tidak boleh
   * menghentikan alur utama) — hasilnya `true` kalau masuk antrean.
   *
   * @param opts.jobId id unik: pesan dengan id yang sama yang MASIH ADA di antrean
   *   (menunggu, sedang diproses, menunggu percobaan ulang, atau sudah sukses)
   *   diabaikan oleh BullMQ, jadi pengingat yang sama tidak terkirim dobel kalau
   *   proses harian dijalankan lebih dari sekali.
   *
   *   Job ber-jobId yang GAGAL FINAL sengaja dihapus (removeOnFail: true), tidak
   *   disimpan seperti job biasa. BullMQ menolak id yang masih tersimpan, apa pun
   *   statusnya (selesai maupun gagal), jadi kalau job gagalnya disimpan, proses
   *   susulan (03:05, 06:05) tidak pernah mencoba ulang pengingat yang gagal waktu
   *   provider WA sedang bermasalah — pengingat baru dicoba lagi esok hari (terbukti
   *   di log produksi 27 Okt 2026). Agar berlaku, WhatsAppProcessor harus melempar
   *   error pada percobaan terakhir (supaya job tercatat GAGAL, bukan "selesai").
   *   Catatan kegagalannya tetap ada di whatsapp_logs.
   */
  async queueNotification(data: WhatsAppJobData, opts: { jobId?: string } = {}): Promise<boolean> {
    try {
      await this.withTimeout(
        this.whatsappQueue.add('send', data, {
          attempts: WA_SEND_ATTEMPTS,
          backoff: { type: 'exponential', delay: WA_RETRY_BASE_DELAY_MS },
          removeOnComplete: 100, // Simpan 100 job terakhir yang sukses
          // Job biasa: simpan 200 yang gagal terakhir (untuk diperiksa). Job ber-jobId:
          // dihapus supaya id-nya bebas dan proses susulan boleh mencoba lagi.
          removeOnFail: opts.jobId ? true : 200,
          ...(opts.jobId ? { jobId: opts.jobId } : {}),
        }),
        QUEUE_ADD_TIMEOUT_MS,
      );
      return true;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Gagal queue WA notification (${data.trigger} → ${data.phone}): ${reason}`);
      await this.recordEnqueueFailure(data, reason);
      return false;
    }
  }

  // Pesan yang tidak sempat masuk antrean dicatat di log WA supaya admin melihatnya
  // (dulu hilang tanpa jejak selain baris di log server).
  private async recordEnqueueFailure(data: WhatsAppJobData, reason: string) {
    try {
      await this.db.insert(whatsappLogs).values({
        tenantId: data.tenantId,
        customerId: data.customerId,
        billId: data.billId,
        trigger: data.trigger,
        phone: data.phone,
        message: data.message,
        provider: 'antrean',
        status: 'failed',
        errorMessage: `Pesan tidak masuk antrean pengiriman: ${reason}`,
      });
    } catch (err) {
      this.logger.error(`Gagal mencatat kegagalan antrean WA ke log: ${err}`);
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Redis/antrean tidak merespons dalam ${ms / 1000} detik`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }
}
