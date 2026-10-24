// Perhitungan periode tagihan. Semua fungsi murni (tanpa database) supaya mudah diuji.
//
// Model periode (bayar di muka): untuk tanggal tagihan D, periode berjalan dari
// tanggal D bulan ini sampai tanggal D-1 bulan depan, dan jatuh tempo = tanggal D
// (awal periode). Tanggal tagihan dibatasi 1–28 (lihat DTO pelanggan), jadi
// tanggalnya selalu ada di setiap bulan.

export interface BillPeriod {
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
}

// Bawaan: tagihan diterbitkan 7 hari sebelum tanggal tagihan (.env: BILL_LEAD_DAYS).
export const DEFAULT_BILL_LEAD_DAYS = 7;
// Dua bulan berurutan tidak boleh sama-sama jatuh di dalam satu jendela.
export const MAX_BILL_LEAD_DAYS = 27;

/** 'YYYY-MM-DD' dari komponen tanggal LOKAL (bukan toISOString yang memakai UTC). */
export function toYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 'YYYY-MM-DD' (atau awalan string ISO) → Date pada tengah malam lokal. */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Periode yang DIMULAI pada `periodStart`. */
export function periodFromStart(periodStart: Date): BillPeriod {
  const y = periodStart.getFullYear();
  const m = periodStart.getMonth();
  const d = periodStart.getDate();
  return {
    periodStart: new Date(y, m, d),
    periodEnd: new Date(y, m + 1, d - 1),
    dueDate: new Date(y, m, d),
  };
}

/** Kemunculan pertama tanggal tagihan pada atau setelah `from`. */
export function firstBillingDateOnOrAfter(billingDate: number, from: Date): Date {
  const f = startOfDay(from);
  const thisMonth = new Date(f.getFullYear(), f.getMonth(), billingDate);
  return thisMonth >= f ? thisMonth : new Date(f.getFullYear(), f.getMonth() + 1, billingDate);
}

/**
 * Awal periode yang tagihannya HARUS sudah terbit hari ini: periode yang mulai
 * dalam [hari ini, hari ini + leadDays]. null kalau tidak ada. Memakai jendela —
 * bukan "tepat hari ini" — supaya tagihan tetap terbit di malam berikutnya kalau
 * server sempat mati pada malam yang seharusnya.
 */
export function periodStartInWindow(billingDate: number, today: Date, leadDays: number): Date | null {
  const t0 = startOfDay(today);
  const start = firstBillingDateOnOrAfter(billingDate, t0);
  return start <= addDays(t0, leadDays) ? start : null;
}
