// Default template pesan WhatsApp per trigger.
// Tenant bisa override ini lewat tabel `whatsapp_templates` (lihat WhatsappTemplatesService).
// File ini adalah satu-satunya sumber kebenaran untuk "apa itu default" —
// dipakai baik untuk render pesan maupun untuk fitur "Reset ke Default".

export type WhatsappTemplateType =
  | 'registration'
  | 'reminder'
  | 'isolir'
  | 'payment';

export const TEMPLATE_TYPES: WhatsappTemplateType[] = [
  'registration',
  'reminder',
  'isolir',
  'payment',
];

export const TEMPLATE_LABELS: Record<WhatsappTemplateType, string> = {
  registration: 'Registrasi Pelanggan Baru',
  reminder: 'Pengingat Tagihan (H-3)',
  isolir: 'Isolir / Pemutusan Layanan',
  payment: 'Konfirmasi Pembayaran',
};

// Variabel yang tersedia untuk masing-masing trigger — ditampilkan di frontend
// sebagai referensi buat admin saat mengedit template.
export const TEMPLATE_VARIABLES: Record<
  WhatsappTemplateType,
  { key: string; description: string }[]
> = {
  registration: [
    { key: 'name', description: 'Nama pelanggan' },
    { key: 'packageName', description: 'Nama paket internet' },
    { key: 'username', description: 'Username PPPoE' },
    { key: 'billingDate', description: 'Tanggal tagihan bulanan (misal: 15)' },
  ],
  reminder: [
    { key: 'name', description: 'Nama pelanggan' },
    { key: 'billNumber', description: 'Nomor tagihan' },
    { key: 'amount', description: 'Jumlah tagihan (sudah diformat Rupiah)' },
    { key: 'dueDate', description: 'Tanggal jatuh tempo' },
    { key: 'sisaWaktu', description: 'Sisa waktu sampai jatuh tempo (otomatis: "3 hari lagi", "besok", atau "hari ini")' },
  ],
  isolir: [
    { key: 'name', description: 'Nama pelanggan' },
    { key: 'billNumber', description: 'Nomor tagihan' },
    { key: 'amount', description: 'Jumlah tagihan (sudah diformat Rupiah)' },
  ],
  payment: [
    { key: 'name', description: 'Nama pelanggan' },
    { key: 'billNumber', description: 'Nomor tagihan' },
    { key: 'amount', description: 'Jumlah tagihan (sudah diformat Rupiah)' },
    { key: 'paidAt', description: 'Tanggal pembayaran' },
    { key: 'keterangan', description: 'Keterangan status layanan (otomatis: diaktifkan kembali / masih ada tagihan lain / terima kasih)' },
  ],
};

export const DEFAULT_TEMPLATES: Record<WhatsappTemplateType, string> = {
  registration:
    `Selamat datang! 🎉\n\n` +
    `Halo *{{name}}*,\n\n` +
    `Akun internet Anda telah berhasil diaktifkan.\n\n` +
    `📦 Paket: *{{packageName}}*\n` +
    `👤 Username: *{{username}}*\n` +
    `📅 Tanggal tagihan: Setiap tgl *{{billingDate}}*\n\n` +
    `Terima kasih telah berlangganan.`,

  reminder:
    `⏰ *Pengingat Tagihan*\n\n` +
    `Halo *{{name}}*,\n\n` +
    `Tagihan internet Anda akan jatuh tempo *{{sisaWaktu}}*.\n\n` +
    `📋 No. Tagihan: *{{billNumber}}*\n` +
    `💰 Jumlah: *Rp {{amount}}*\n` +
    `📅 Jatuh Tempo: *{{dueDate}}*\n\n` +
    `Mohon segera lakukan pembayaran untuk menghindari pemutusan layanan.`,

  isolir:
    `⚠️ *Layanan Dinonaktifkan*\n\n` +
    `Halo *{{name}}*,\n\n` +
    `Layanan internet Anda telah *dinonaktifkan* karena tagihan belum dibayar.\n\n` +
    `📋 No. Tagihan: *{{billNumber}}*\n` +
    `💰 Jumlah: *Rp {{amount}}*\n\n` +
    `Silakan lakukan pembayaran untuk mengaktifkan kembali layanan Anda.`,

  payment:
    `✅ *Pembayaran Berhasil*\n\n` +
    `Halo *{{name}}*,\n\n` +
    `Pembayaran tagihan Anda telah dikonfirmasi.\n\n` +
    `📋 No. Tagihan: *{{billNumber}}*\n` +
    `💰 Jumlah: *Rp {{amount}}*\n` +
    `📅 Tanggal Bayar: *{{paidAt}}*\n\n` +
    `{{keterangan}}`,
};

// Sisa waktu pengingat dalam bahasa pelanggan: 0 → "hari ini", 1 → "besok", n → "n hari lagi".
export function sisaWaktuText(daysLeft: number): string {
  if (daysLeft <= 0) return 'hari ini';
  if (daysLeft === 1) return 'besok';
  return `${daysLeft} hari lagi`;
}

// Keterangan di bawah konfirmasi pembayaran. Dulu kalimat "layanan telah diaktifkan
// kembali" tertulis tetap, sehingga ikut terkirim ke pelanggan yang tidak pernah
// diisolir dan ke pelanggan yang masih punya tagihan lain.
export type PaymentNoteKind =
  | { kind: 'reactivated' }
  | { kind: 'thanks' }
  | { kind: 'pending-activation' }
  // isolated: pelanggan sedang diisolir (layanan baru aktif setelah SEMUA lunas);
  // false: layanan masih berjalan, tinggal mengingatkan agar sisanya dilunasi.
  | { kind: 'arrears'; billNumbers: string[]; isolated: boolean };

export function paymentKeterangan(note: PaymentNoteKind): string {
  switch (note.kind) {
    case 'reactivated':
      return 'Layanan internet Anda telah diaktifkan kembali. Terima kasih! 🙏';
    case 'pending-activation':
      return 'Pembayaran Anda sudah kami terima dan layanan sedang kami aktifkan kembali. Terima kasih! 🙏';
    case 'arrears':
      return (
        `Masih ada tagihan lain yang belum dibayar: ${note.billNumbers.join(', ')}. ` +
        (note.isolated
          ? 'Layanan akan diaktifkan kembali setelah semua tagihan tersebut lunas.'
          : 'Mohon segera dilunasi agar layanan Anda tidak terputus.')
      );
    default:
      return 'Terima kasih atas pembayaran Anda! 🙏';
  }
}

export function formatRupiah(amount: string | number): string {
  return Number(amount).toLocaleString('id-ID', { minimumFractionDigits: 0 });
}

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// 'YYYY-MM-DD' → '20 Oktober 2026'. Sengaja memotong string, bukan lewat
// `new Date()`: kolom `date` dari MySQL sebaiknya tidak ikut digeser zona waktu
// server, dan hasilnya tidak bergantung pada ICU/locale Node.
// Input yang bukan 'YYYY-MM-DD' dikembalikan apa adanya.
export function formatTanggal(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  const bulan = NAMA_BULAN[Number(m[2]) - 1];
  if (!bulan) return isoDate;
  return `${Number(m[3])} ${bulan} ${m[1]}`;
}

// Ganti semua {{key}} pada content dengan value dari data.
// Placeholder yang tidak dikenal sengaja dibiarkan apa adanya (bukan dikosongkan)
// supaya salah ketik nama variabel tidak bikin informasi penting hilang diam-diam.
export function renderTemplate(
  content: string,
  data: Record<string, string>,
): string {
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(data, key) ? data[key] : match,
  );
}
