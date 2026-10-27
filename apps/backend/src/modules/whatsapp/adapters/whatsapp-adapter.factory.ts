import type { WhatsappConfig } from '../../../database/schema';
import type { IWhatsAppAdapter } from './whatsapp-adapter.interface';
import { FonnteAdapter } from './fonnte.adapter';
import { WaBlastAdapter } from './wablast.adapter';
import { MetaAdapter } from './meta.adapter';

// extraConfig yang bukan JSON valid dulu muncul sebagai galat JSON.parse yang
// membingungkan ("Unexpected token ... in JSON at position 0").
function parseExtraConfig<T extends object>(config: WhatsappConfig): Partial<T> {
  if (!config.extraConfig) return {};
  try {
    return JSON.parse(config.extraConfig) as Partial<T>;
  } catch {
    throw new Error(
      `Pengaturan tambahan (extraConfig) provider '${config.provider}' bukan JSON yang valid — simpan ulang pengaturan WhatsApp`,
    );
  }
}

export class WhatsAppAdapterFactory {
  static create(config: WhatsappConfig): IWhatsAppAdapter {
    switch (config.provider) {
      case 'fonnte':
        return new FonnteAdapter(config.apiKey);

      case 'wablast': {
        // WA Blast cuma butuh domain dari extraConfig — token (apiKey) sudah
        // string utuh dari dashboard Wablas, dipakai apa adanya.
        const extra = parseExtraConfig<{ domain: string }>(config);

        if (!extra.domain) {
          throw new Error("WA Blast adapter butuh 'domain' di extraConfig");
        }

        return new WaBlastAdapter(config.apiKey, extra.domain);
      }

      case 'meta': {
        // Meta butuh phone_number_id dari extraConfig
        const extra = parseExtraConfig<{ phone_number_id: string }>(config);

        if (!extra.phone_number_id) {
          throw new Error('Meta adapter butuh phone_number_id di extraConfig');
        }

        return new MetaAdapter(config.apiKey, extra.phone_number_id);
      }

      default:
        throw new Error(`Provider '${config.provider}' tidak didukung`);
    }
  }
}