import { Logger } from '@nestjs/common';
import type { IWhatsAppAdapter, WhatsAppSendResult } from './whatsapp-adapter.interface';
import { normalizePhone } from './whatsapp-adapter.interface';
import { readJsonResponse } from './http-response.util';

export class MetaAdapter implements IWhatsAppAdapter {
  private readonly logger = new Logger(MetaAdapter.name);
  private readonly timeoutMs = 15000;

  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
  ) {}

  async send(phone: string, message: string): Promise<WhatsAppSendResult> {
    const to = normalizePhone(phone);
    const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
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

      const data = await readJsonResponse(response, 'Meta WhatsApp');

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
        error: String(error?.message ?? `Respons tidak dikenali (HTTP ${response.status})`),
      };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'AbortError';
      const detail = timedOut ? `Timeout setelah ${this.timeoutMs}ms — Meta tidak merespons` : String(err);
      this.logger.error(`Meta WA send error: ${detail}`);
      return { success: false, error: detail };
    } finally {
      clearTimeout(timer);
    }
  }
}