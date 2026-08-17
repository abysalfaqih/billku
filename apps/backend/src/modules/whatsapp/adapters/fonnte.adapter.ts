import { Logger } from '@nestjs/common';
import type { IWhatsAppAdapter, WhatsAppSendResult } from './whatsapp-adapter.interface';
import { normalizePhone } from './whatsapp-adapter.interface';

export class FonnteAdapter implements IWhatsAppAdapter {
  private readonly logger = new Logger(FonnteAdapter.name);
  private readonly baseUrl = 'https://api.fonnte.com/send';

  constructor(private readonly token: string) {}

  async send(phone: string, message: string): Promise<WhatsAppSendResult> {
    const target = normalizePhone(phone);

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
      this.logger.error(`Fonnte send error: ${err}`);
      return { success: false, error: String(err) };
    }
  }
}