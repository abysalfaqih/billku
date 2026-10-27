import { Logger } from '@nestjs/common';
import type { IWhatsAppAdapter, WhatsAppSendResult } from './whatsapp-adapter.interface';
import { normalizePhone } from './whatsapp-adapter.interface';
import { readJsonResponse } from './http-response.util';

interface WablasSendResponse {
  status: boolean;
  message?: string;
  data?: {
    messages?: Array<{ id: string }> | { id: string };
  };
}

export class WaBlastAdapter implements IWhatsAppAdapter {
  private readonly logger = new Logger(WaBlastAdapter.name);
  private readonly timeoutMs = 15000;

  // token = TOKEN UTUH dari dashboard Wablas, menu Device - Settings.
  // Wablas menampilkannya sebagai satu string (format: xxxxx.yyyyy) — tempel
  // apa adanya, tidak perlu dipecah jadi token+secret terpisah.
  // domain = domain API akun Anda, apa adanya, misal https://solo.wablas.com
  constructor(
    private readonly token: string,
    private readonly domain: string,
  ) {}

  async send(phone: string, message: string): Promise<WhatsAppSendResult> {
    const number = normalizePhone(phone);
    const url = `${this.domain.replace(/\/+$/, '')}/api/send-message`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const body = new URLSearchParams({ phone: number, message });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.token,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: controller.signal,
      });

      const data = (await readJsonResponse(
        response,
        'WA Blast',
        `periksa "Domain API" di pengaturan WhatsApp (sekarang: ${this.domain})`,
      )) as unknown as WablasSendResponse;

      if (response.ok && data.status === true) {
        const messages = data.data?.messages;
        const first = Array.isArray(messages) ? messages[0] : messages;
        return {
          success: true,
          messageId: first?.id ?? '',
        };
      }

      return {
        success: false,
        error: data.message ? String(data.message) : `Respons tidak dikenali (HTTP ${response.status})`,
      };
    } catch (err) {
      const detail = this.describeError(err);
      this.logger.error(`WA Blast send error: ${detail}`);
      return { success: false, error: detail };
    } finally {
      clearTimeout(timer);
    }
  }

  // Node/undici sering cuma buang "TypeError: fetch failed" tanpa detail —
  // root cause asli (ENOTFOUND, ECONNRESET, ETIMEDOUT, dll) nyimpen di err.cause.
  // Fungsi ini memastikan detail itu ikut ke-log, plus bedain kasus timeout.
  private describeError(err: unknown): string {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return `Timeout setelah ${this.timeoutMs}ms — ${this.domain} tidak merespons`;
      }
      const cause = (err as Error & { cause?: unknown }).cause;
      return cause ? `${err.message} | cause: ${String(cause)}` : err.message;
    }
    return String(err);
  }
}