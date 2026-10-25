// Satu-satunya sumber "hari ini" untuk urusan tagihan: pembuatan tagihan, jatuh
// tempo, isolir, dan pengingat.
//
// Dulu sebagian memakai kalender proses Node (`new Date()`), sebagian memakai
// CURDATE() milik database. Kalau zona waktu keduanya berbeda (umum: MySQL di
// server/Docker berzona UTC, aplikasi berzona WIB), saat cron berjalan pukul
// 00:05 WIB database masih "kemarin" — isolir mundur sehari dan pengingat
// bergeser (H-3 menjadi H-2). Sekarang semuanya memakai kalender WIB dan
// tanggalnya dikirim ke SQL sebagai parameter, jadi zona waktu server maupun
// database tidak lagi berpengaruh.
export const APP_TIMEZONE = 'Asia/Jakarta';

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Tanggal kalender WIB pada saat `now`, berformat 'YYYY-MM-DD'. */
export function ymdInAppTz(now: Date = new Date()): string {
  const parts = ymdFormatter.formatToParts(now);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/**
 * Tanggal kalender WIB sebagai `Date` tengah malam LOKAL proses (komponen
 * tahun/bulan/tanggalnya sama dengan kalender WIB), supaya fungsi periode yang
 * memakai komponen lokal (billing-period.util) tetap benar apa pun zona waktu
 * server.
 */
export function todayInAppTz(now: Date = new Date()): Date {
  const [y, m, d] = ymdInAppTz(now).split('-').map(Number);
  return new Date(y, m - 1, d);
}
