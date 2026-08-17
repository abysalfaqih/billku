export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IWhatsAppAdapter {
  send(phone: string, message: string): Promise<WhatsAppSendResult>;
}

// Normalisasi nomor HP ke format internasional tanpa +
// Contoh: 081234567890 → 6281234567890
export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s\-\(\)\+]/g, '');

  if (normalized.startsWith('0')) {
    normalized = '62' + normalized.substring(1);
  } else if (normalized.startsWith('8')) {
    normalized = '62' + normalized;
  }

  return normalized;
}