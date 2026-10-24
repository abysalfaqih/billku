import type { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

// Baca pengaturan .env berupa bilangan bulat >= 0. Nilai kosong / tidak ada →
// bawaan; nilai aneh (' ', '1.5', '-1', '1e3', di atas `max`) → bawaan + peringatan.
// Sengaja TIDAK memakai Number(): Number(' ') bernilai 0, yang bisa diam-diam
// mematikan sebuah fitur hanya karena salah ketik.
export function readNonNegativeInt(
  config: ConfigService,
  key: string,
  fallback: number,
  logger: Logger,
  max = 100_000,
): number {
  const raw = config.get<string | number>(key);
  if (raw === undefined || raw === null) return fallback;
  const text = String(raw).trim();
  if (text === '') return fallback;
  if (!/^\d{1,6}$/.test(text) || Number(text) > max) {
    logger.warn(`⚠️ ${key}='${text}' tidak valid — dipakai nilai bawaan ${fallback}`);
    return fallback;
  }
  return Number(text);
}
