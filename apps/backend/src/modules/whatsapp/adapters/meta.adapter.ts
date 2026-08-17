import { Logger } from '@nestjs/common';
import type { IWhatsAppAdapter, WhatsAppSendResult } from './whatsapp-adapter.interface';
import { normalizePhone } from './whatsapp-adapter.interface';

export class MetaAdapter implements IWhatsAppAdapter {
  private readonly logger = new Logger(MetaAdapter.name);

  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
  ) {}

  async send(phone: string, message: string): Promise<WhatsAppSendResult> {
    const to = normalizePhone(phone);
    const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        }),
      });

      const data = await response.json() as Record<string, unknown>;

      if (response.ok) {
        const messages = data.messages as Array<{ id: string }> | undefined;
        return {
          success: true,
          messageId: messages?.[0]?.id ?? '',
        };
      }

      const error = data.error as Record<string, unknown> | undefined;
      return {
        success: false,
        error: String(error?.message ?? 'Unknown error'),
      };
    } catch (err) {
      this.logger.error(`Meta WA send error: ${err}`);
      return { success: false, error: String(err) };
    }
  }
}