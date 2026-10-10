/**
 * Laporan umur piutang (aging report).
 *
 * File ini sengaja berisi fungsi murni (tanpa akses database) supaya aturan
 * pengelompokannya mudah dibaca dan diuji. ReportsService cukup mengambil
 * tagihan yang belum lunas lalu menyerahkannya ke buildAgingReport().
 */

export type AgingBucketKey =
  'current' | 'd1_7' | 'd8_30' | 'd31_60' | 'd61_90' | 'd90plus';

export interface AgingBucketDef {
  key: AgingBucketKey;
  label: string;
  /** Batas bawah (hari lewat jatuh tempo), inklusif. */
  minDays: number;
  /** Batas atas, inklusif. null = tanpa batas atas. */
  maxDays: number | null;
}

// Urutan penting: dari yang paling baru ke yang paling lama menunggak.
// "current" = belum lewat jatuh tempo (termasuk yang jatuh tempo hari ini).
export const AGING_BUCKETS: readonly AgingBucketDef[] = [
  {
    key: 'current',
    label: 'Belum jatuh tempo',
    minDays: Number.NEGATIVE_INFINITY,
    maxDays: 0,
  },
  { key: 'd1_7', label: '1–7 hari', minDays: 1, maxDays: 7 },
  { key: 'd8_30', label: '8–30 hari', minDays: 8, maxDays: 30 },
  { key: 'd31_60', label: '31–60 hari', minDays: 31, maxDays: 60 },
  { key: 'd61_90', label: '61–90 hari', minDays: 61, maxDays: 90 },
  { key: 'd90plus', label: '> 90 hari', minDays: 91, maxDays: null },
];

export function bucketKeyFor(daysOverdue: number): AgingBucketKey {
  for (const b of AGING_BUCKETS) {
    if (
      daysOverdue >= b.minDays &&
      (b.maxDays === null || daysOverdue <= b.maxDays)
    ) {
      return b.key;
    }
  }
  // Tidak mungkin tercapai (rentang menutup semua bilangan), tapi tetap aman.
  return 'd90plus';
}

/** Satu baris tagihan belum lunas, hasil query ReportsService.getAgingReport(). */
export interface AgingBillRow {
  billId: number;
  billNumber: string;
  customerId: number;
  customerCode: string | null;
  customerName: string;
  customerPhone: string;
  customerStatus: 'active' | 'isolated' | 'suspended' | 'terminated';
  /** decimal dari MySQL datang sebagai string. */
  totalAmount: string | number;
  dueDate: string;
  /** DATEDIFF(hari ini, due_date): positif = sudah lewat jatuh tempo. */
  daysOverdue: number | string;
}

export type AgingAmounts = Record<AgingBucketKey, number>;

export interface AgingCustomerRow {
  customerId: number;
  customerCode: string | null;
  name: string;
  phone: string;
  status: AgingBillRow['customerStatus'];
  billCount: number;
  /** Total semua tagihan belum lunas pelanggan ini (termasuk yang belum jatuh tempo). */
  total: number;
  /** Tagihan tertua (paling lama menunggak) — dipakai untuk urutan & tautan. */
  oldestBillId: number;
  oldestBillNumber: string;
  oldestDueDate: string;
  oldestDaysOverdue: number;
  /** Rincian nominal per kelompok umur. */
  amounts: AgingAmounts;
}

export interface AgingBucketSummary {
  key: AgingBucketKey;
  label: string;
  minDays: number | null;
  maxDays: number | null;
  billCount: number;
  /** Pelanggan unik yang punya minimal satu tagihan di kelompok ini. */
  customerCount: number;
  total: number;
}

export interface AgingReport {
  summary: {
    /** Semua tagihan belum lunas (pelanggan berhenti tidak dihitung). */
    outstandingTotal: number;
    outstandingBillCount: number;
    /** Hanya yang sudah lewat jatuh tempo. */
    overdueTotal: number;
    overdueBillCount: number;
    overdueCustomerCount: number;
    /** Hari menunggak tagihan tertua; 0 bila tidak ada tunggakan. */
    oldestDaysOverdue: number;
  };
  buckets: AgingBucketSummary[];
  /** Pelanggan (selain yang berhenti) yang punya tunggakan, tertua dulu. */
  customers: AgingCustomerRow[];
  /**
   * Tunggakan pelanggan yang sudah berhenti. Dipisah karena kecil
   * kemungkinan tertagih dan tidak boleh mengotori angka utama.
   */
  terminated: {
    billCount: number;
    customerCount: number;
    total: number;
    customers: AgingCustomerRow[];
  };
}

// Uang dijumlah dalam sen (bilangan bulat) agar tidak kena galat desimal.
const toCents = (v: string | number): number => Math.round(Number(v) * 100);
const fromCents = (c: number): number => c / 100;

const emptyAmounts = (): Record<AgingBucketKey, number> => ({
  current: 0,
  d1_7: 0,
  d8_30: 0,
  d31_60: 0,
  d61_90: 0,
  d90plus: 0,
});

interface CustomerAcc {
  row: Omit<AgingCustomerRow, 'total' | 'amounts'>;
  totalCents: number;
  amountCents: Record<AgingBucketKey, number>;
}

function groupByCustomer(rows: AgingBillRow[]): CustomerAcc[] {
  const map = new Map<number, CustomerAcc>();

  for (const r of rows) {
    const days = Number(r.daysOverdue);
    const cents = toCents(r.totalAmount);
    const key = bucketKeyFor(days);

    let acc = map.get(r.customerId);
    if (!acc) {
      acc = {
        row: {
          customerId: r.customerId,
          customerCode: r.customerCode,
          name: r.customerName,
          phone: r.customerPhone,
          status: r.customerStatus,
          billCount: 0,
          oldestBillId: r.billId,
          oldestBillNumber: r.billNumber,
          oldestDueDate: r.dueDate,
          oldestDaysOverdue: days,
        },
        totalCents: 0,
        amountCents: emptyAmounts(),
      };
      map.set(r.customerId, acc);
    }

    acc.row.billCount += 1;
    acc.totalCents += cents;
    acc.amountCents[key] += cents;

    // Tagihan tertua = yang paling banyak hari lewat jatuh tempo.
    // Kalau seri, pakai id terkecil supaya hasilnya stabil.
    if (
      days > acc.row.oldestDaysOverdue ||
      (days === acc.row.oldestDaysOverdue && r.billId < acc.row.oldestBillId)
    ) {
      acc.row.oldestBillId = r.billId;
      acc.row.oldestBillNumber = r.billNumber;
      acc.row.oldestDueDate = r.dueDate;
      acc.row.oldestDaysOverdue = days;
    }
  }

  return [...map.values()];
}

function toCustomerRow(acc: CustomerAcc): AgingCustomerRow {
  const amounts = emptyAmounts();
  (Object.keys(amounts) as AgingBucketKey[]).forEach((k) => {
    amounts[k] = fromCents(acc.amountCents[k]);
  });
  return { ...acc.row, total: fromCents(acc.totalCents), amounts };
}

// Tunggakan terlama dulu; kalau sama, yang nominalnya lebih besar dulu.
function sortOldestFirst(a: AgingCustomerRow, b: AgingCustomerRow): number {
  if (b.oldestDaysOverdue !== a.oldestDaysOverdue) {
    return b.oldestDaysOverdue - a.oldestDaysOverdue;
  }
  if (b.total !== a.total) return b.total - a.total;
  return a.customerId - b.customerId;
}

/**
 * @param rows tagihan berstatus unpaid/overdue milik SATU tenant.
 */
export function buildAgingReport(rows: AgingBillRow[]): AgingReport {
  const active = rows.filter((r) => r.customerStatus !== 'terminated');
  const terminated = rows.filter((r) => r.customerStatus === 'terminated');

  // ── Kelompok umur (hanya pelanggan yang masih berlangganan) ──
  const bucketBills = new Map<
    AgingBucketKey,
    { count: number; cents: number; customers: Set<number> }
  >();
  for (const b of AGING_BUCKETS)
    bucketBills.set(b.key, { count: 0, cents: 0, customers: new Set() });

  for (const r of active) {
    const slot = bucketBills.get(bucketKeyFor(Number(r.daysOverdue)))!;
    slot.count += 1;
    slot.cents += toCents(r.totalAmount);
    slot.customers.add(r.customerId);
  }

  const buckets: AgingBucketSummary[] = AGING_BUCKETS.map((b) => {
    const slot = bucketBills.get(b.key)!;
    return {
      key: b.key,
      label: b.label,
      minDays: Number.isFinite(b.minDays) ? b.minDays : null,
      maxDays: b.maxDays,
      billCount: slot.count,
      customerCount: slot.customers.size,
      total: fromCents(slot.cents),
    };
  });

  // ── Daftar pelanggan ──
  const activeCustomers = groupByCustomer(active).map(toCustomerRow);
  const terminatedCustomers = groupByCustomer(terminated).map(toCustomerRow);

  // Yang masuk daftar penagihan: minimal satu tagihan sudah lewat jatuh tempo.
  const overdueCustomers = activeCustomers
    .filter((c) => c.oldestDaysOverdue >= 1)
    .sort(sortOldestFirst);
  const terminatedOverdue = terminatedCustomers.sort(sortOldestFirst);

  // ── Ringkasan ──
  let outstandingCents = 0;
  let overdueCents = 0;
  let overdueBills = 0;
  for (const b of AGING_BUCKETS) {
    const slot = bucketBills.get(b.key)!;
    outstandingCents += slot.cents;
    if (b.key !== 'current') {
      overdueCents += slot.cents;
      overdueBills += slot.count;
    }
  }

  const terminatedCents = terminated.reduce(
    (s, r) => s + toCents(r.totalAmount),
    0,
  );

  return {
    summary: {
      outstandingTotal: fromCents(outstandingCents),
      outstandingBillCount: active.length,
      overdueTotal: fromCents(overdueCents),
      overdueBillCount: overdueBills,
      overdueCustomerCount: overdueCustomers.length,
      oldestDaysOverdue: overdueCustomers[0]?.oldestDaysOverdue ?? 0,
    },
    buckets,
    customers: overdueCustomers,
    terminated: {
      billCount: terminated.length,
      customerCount: terminatedOverdue.length,
      total: fromCents(terminatedCents),
      customers: terminatedOverdue,
    },
  };
}
