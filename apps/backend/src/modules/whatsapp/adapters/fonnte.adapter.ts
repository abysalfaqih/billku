import { Logger } from '@nestjs/common';
import type { IWhatsAppAdapter, WhatsAppSendResult } from './whatsapp-adapter.interface';
import { normalizePhone } from './whatsapp-adapter.interface';

export class FonnteAdapter implements IWhatsAppAdapter {
  private readonly logger = new Logger(FonnteAdapter.name);
  private readonly baseUrl = 'https://api.fonnte.com/send';
  private readonly timeoutMs = 15000;

  constructor(private readonly token: string) {}

  async send(phone: string, message: string): Promise<WhatsAppSendResult> {
    const target = normalizePhone(phone);

    // Tanpa batas waktu, satu permintaan yang menggantung menahan SEMUA pesan di
    // belakangnya (antrean memproses satu per satu) — pengingat jadi telat berjam-jam.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: this.token,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          target,
          message,
          countryCode: '62',
        }).toString(),
        signal: controller.signal,
      });

      const data = await response.json() as Record<string, unknown>;

      if (data.status === true) {
        return {
          success: true,
          messageId: String(data.id ?? ''),
        };
      }

      return {
        success: false,
        error: String(data.reason ?? 'Unknown error'),
      };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'AbortError';
      const detail = timedOut ? `Timeout setelah ${this.timeoutMs}ms — Fonnte tidak merespons` : String(err);
      this.logger.error(`Fonnte send error: ${detail}`);
      return { success: false, error: detail };
    } finally {
      clearTimeout(timer);
    }
  }
}