// Pemformat teks untuk halaman monitoring (murni, tanpa React).

/** Ukuran data hotspot. MikroTik mengirim angka byte sebagai string. */
export function formatBytes(bytes: string | undefined): string {
  const n = parseInt(bytes ?? '0', 10);
  if (!Number.isFinite(n) || n < 0) return '0 B';
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(2)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n >= 1_024) return `${(n / 1_024).toFixed(0)} KB`;
  return `${n} B`;
}

/**
 * Uptime MikroTik ditulis rapat ("1d2h3m4s"). Diberi spasi antarsatuan agar mudah dibaca
 * ("1d 2h 3m 4s"). Teks yang bukan format itu dikembalikan apa adanya.
 */
export function formatUptime(uptime: string | undefined): string {
  if (!uptime) return '';
  return /^(\d+[wdhms])+$/.test(uptime) ? uptime.replace(/([wdhms])(?=\d)/g, '$1 ') : uptime;
}
