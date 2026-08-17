import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { WhatsAppJobData } from './whatsapp-job.interface';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    @InjectQueue('whatsapp') private whatsappQueue: Queue<WhatsAppJobData>,
  ) {}

  async queueNotification(data: WhatsAppJobData): Promise<void> {
    try {
      await this.whatsappQueue.add('send', data, {
        attempts: 3,        // Coba kirim 3x jika gagal
        backoff: {
          type: 'exponential',
          delay: 5000,       // Delay 5s, 10s, 20s antar retry
        },
        removeOnComplete: 100,  // Simpan 100 job terakhir yang sukses
        removeOnFail: 200,      // Simpan 200 job terakhir yang gagal
      });
    } catch (err) {
      // Jangan lempar error — gagal queue tidak boleh stop flow utama
      this.logger.error(`Gagal queue WA notification: ${err}`);
    }
  }
}