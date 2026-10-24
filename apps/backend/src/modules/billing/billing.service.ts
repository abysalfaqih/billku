import {
  Injectable, Inject, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { eq, and, or, count, desc, asc, ne, like, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { bills, customers, packages, tenants, payments, users } from '../../database/schema';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { QueryBillingDto } from './dto/query-billing.dto';
import { buildInvoicePdf } from './invoice-pdf.util';
import {
  firstBillingDateOnOrAfter, parseYmd, periodFromStart, startOfDay, toYmd,
} from './billing-period.util';
import type { BillPeriod } from './billing-period.util';

// Yang dibutuhkan untuk membuat nomor tagihan: bisa koneksi biasa ataupun transaksi.
type SelectCapable = Pick<DrizzleClient, 'select'>;

export interface AdvancePlanItem {
  /** null = tagihan belum ada dan akan dibuat; angka = tagihan belum lunas yang sudah ada */
  billId: number | null;
  billNumber: string | null;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  dueDate: string;
  amount: string;
  taxPercent: string | null;
  taxAmount: string;
  totalAmount: string;
  packageName: string;
}

export interface AdvancePlan {
  customer: { id: number; name: string; phone: string; billingDate: number };
  items: AdvancePlanItem[];
  totalAmount: string;
}

@Injectable()
export class BillingService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  async generateManual(customerId: number, user: AuthUser) {
    return this.generateForCustomer(customerId, user.tenantId);
  }

  /**
   * @param periodStart awal periode yang ditagih. Kosong = periode bulan berjalan
   *   (perilaku tombol "Generate Tagihan"); scheduler mengisinya dengan periode
   *   yang akan datang supaya tagihan terbit lebih awal.
   */
  async generateForCustomer(customerId: number, tenantId: string, periodStart?: Date) {
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
      .limit(1);

    if (!customer) throw new NotFoundException('Pelanggan tidak ditemukan');
    if (customer.status !== 'active') throw new BadRequestException('Tagihan hanya bisa dibuat untuk pelanggan aktif');
    if (!customer.packageId) throw new BadRequestException('Pelanggan belum punya paket');

    const [pkg] = await this.db.select().from(packages).where(eq(packages.id, customer.packageId)).limit(1);
    if (!pkg) throw new NotFoundException('Paket pelanggan tidak ditemukan');

    const period = this.calculatePeriod(customer.billingDate, periodStart);

    const [existing] = await this.db
      .select({ id: bills.id, status: bills.status })
      .from(bills)
      .where(and(eq(bills.customerId, customerId), eq(bills.tenantId, tenantId), eq(bills.periodStart, period.periodStart)))
      .limit(1);

    if (existing && existing.status !== 'cancelled') {
      throw new ConflictException('Tagihan untuk periode ini sudah ada');
    }

    const billNumber = await this.generateBillNumber(tenantId, period.periodStart);
    const amounts = this.computeBillAmounts(customer, pkg);

    const [result] = await this.db.insert(bills).values({
      tenantId, customerId, billNumber,
      periodStart: period.periodStart, periodEnd: period.periodEnd, dueDate: period.dueDate,
      ...amounts,
      packageName: pkg.name,
    });

    return this.findOne(Number(result.insertId), { tenantId } as AuthUser);
  }

  async findAll(query: QueryBillingDto, user: AuthUser) {
    const { page = 1, limit = 20, status, customerId, search } = query;
    const offset = (page - 1) * limit;

    const keyword = search?.trim();
    const searchCondition = keyword
      ? or(
          like(bills.billNumber, `%${keyword}%`),
          like(customers.name, `%${keyword}%`),
          like(customers.phone, `%${keyword}%`),
          like(customers.customerCode, `%${keyword}%`),
        )
      : undefined;

    const where = and(
      eq(bills.tenantId, user.tenantId),
      status ? eq(bills.status, status) : undefined,
      customerId ? eq(bills.customerId, customerId) : undefined,
      searchCondition,
    );

    const [data, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: bills.id,
          tenantId: bills.tenantId,
          customerId: bills.customerId,
          customerName: customers.name, // ← BARU: nama pelanggan, sebelumnya tidak pernah di-select
          billNumber: bills.billNumber,
          periodStart: bills.periodStart,
          periodEnd: bills.periodEnd,
          dueDate: bills.dueDate,
          amount: bills.amount,
          taxPercent: bills.taxPercent,
          taxAmount: bills.taxAmount,
          totalAmount: bills.totalAmount,
          packageName: bills.packageName,
          status: bills.status,
          notes: bills.notes,
          createdAt: bills.createdAt,
          updatedAt: bills.updatedAt,
        })
        .from(bills)
        .leftJoin(customers, eq(bills.customerId, customers.id))
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(bills.createdAt)),
      // join customers juga di sini: kondisi pencarian memakai kolom customers
      this.db.select({ total: count() }).from(bills)
        .leftJoin(customers, eq(bills.customerId, customers.id))
        .where(where),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: number, user: AuthUser) {
    const [bill] = await this.db
      .select({
        id: bills.id,
        tenantId: bills.tenantId,
        customerId: bills.customerId,
        customerName: customers.name, // ← BARU
        billNumber: bills.billNumber,
        periodStart: bills.periodStart,
        periodEnd: bills.periodEnd,
        dueDate: bills.dueDate,
        amount: bills.amount,
        taxPercent: bills.taxPercent,
        taxAmount: bills.taxAmount,
        totalAmount: bills.totalAmount,
        packageName: bills.packageName,
        status: bills.status,
        notes: bills.notes,
        createdAt: bills.createdAt,
        updatedAt: bills.updatedAt,
      })
      .from(bills)
      .leftJoin(customers, eq(bills.customerId, customers.id))
      .where(and(eq(bills.id, id), eq(bills.tenantId, user.tenantId)))
      .limit(1);
    if (!bill) throw new NotFoundException(`Tagihan #${id} tidak ditemukan`);
    return bill;
  }

  /**
   * Data untuk halaman detail tagihan: tagihan + pelanggan + riwayat pembayaran.
   * Sama polanya dengan GET /customers/:id/detail — satu panggilan, semua
   * dibatasi tenant.
   */
  async getDetail(id: number, user: AuthUser) {
    // findOne sudah memfilter tenant & melempar 404 kalau tidak ada
    const bill = await this.findOne(id, user);

    const [[customer], billPayments, [overdue]] = await Promise.all([
      this.db
        .select({
          id: customers.id,
          customerCode: customers.customerCode,
          name: customers.name,
          phone: customers.phone,
          address: customers.address,
          status: customers.status,
        })
        .from(customers)
        .where(and(eq(customers.id, bill.customerId), eq(customers.tenantId, user.tenantId)))
        .limit(1),
      this.db
        .select({
          id: payments.id,
          amount: payments.amount,
          paymentMethod: payments.paymentMethod,
          paidAt: payments.paidAt,
          notes: payments.notes,
          createdBy: payments.createdBy,
          createdByName: users.name,
        })
        .from(payments)
        .leftJoin(users, eq(payments.createdBy, users.id))
        .where(and(eq(payments.billId, id), eq(payments.tenantId, user.tenantId)))
        .orderBy(desc(payments.paidAt)),
      // Selisih hari dihitung oleh database (CURDATE()), sama seperti scheduler
      // dan laporan umur piutang: positif = terlambat, negatif = belum jatuh tempo.
      this.db
        .select({ daysOverdue: sql<number>`DATEDIFF(CURDATE(), ${bills.dueDate})` })
        .from(bills)
        .where(and(eq(bills.id, id), eq(bills.tenantId, user.tenantId)))
        .limit(1),
    ]);

    return {
      bill,
      customer: customer ?? null,
      payments: billPayments,
      daysOverdue: Number(overdue?.daysOverdue ?? 0),
    };
  }

  async cancel(id: number, user: AuthUser) {
    const bill = await this.findOne(id, user);
    if (bill.status === 'paid') throw new BadRequestException('Tagihan yang sudah dibayar tidak bisa dibatalkan');
    if (bill.status === 'cancelled') throw new BadRequestException('Tagihan sudah dibatalkan sebelumnya');

    await this.db
      .update(bills)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(bills.id, id), eq(bills.tenantId, user.tenantId)));

    return { message: 'Tagihan berhasil dibatalkan' };
  }

  // ── Export Invoice PDF ────────────────────────────────────────────
  async generateInvoicePdf(id: number, user: AuthUser): Promise<Buffer> {
    const bill = await this.findOne(id, user);

    const [customer] = await this.db
      .select({
        id: customers.id, customerCode: customers.customerCode,
        name: customers.name, phone: customers.phone, address: customers.address,
      })
      .from(customers)
      .where(eq(customers.id, bill.customerId))
      .limit(1);

    const [tenant] = await this.db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);

    let payment: { paidAt: Date } | undefined;
    if (bill.status === 'paid') {
      [payment] = await this.db
        .select({ paidAt: payments.paidAt })
        .from(payments)
        .where(eq(payments.billId, bill.id))
        .orderBy(desc(payments.paidAt))
        .limit(1);
    }

    let bankAccounts: Array<{ bankName: string; accountNumber: string; accountName: string }> = [];
    try {
      bankAccounts = tenant?.bankAccounts ? JSON.parse(tenant.bankAccounts) : [];
    } catch {
      bankAccounts = [];
    }

    return buildInvoicePdf({
      tenant: {
        name: tenant?.name ?? '-',
        address: tenant?.address ?? null,
        phone: tenant?.phone ?? '-',
        email: tenant?.email ?? '-',
        motto: tenant?.motto ?? null,
        bankAccounts,
      },
      customer: {
        id: customer?.id ?? bill.customerId,
        customerCode: customer?.customerCode ?? null,
        name: customer?.name ?? '-',
        phone: customer?.phone ?? '-',
        address: customer?.address ?? null,
      },
      bill: {
        billNumber: bill.billNumber,
        periodStart: bill.periodStart,
        periodEnd: bill.periodEnd,
        dueDate: bill.dueDate,
        packageName: bill.packageName,
        amount: bill.amount,
        taxPercent: bill.taxPercent,
        taxAmount: bill.taxAmount,
        totalAmount: bill.totalAmount,
        status: bill.status,
        createdAt: bill.createdAt,
      },
      payment: payment ?? null,
    });
  }

  async exportCsv(user: AuthUser): Promise<string> {
    const all = await this.db
      .select({
        billNumber: bills.billNumber, customerId: bills.customerId,
        customerName: customers.name, // ← BARU
        packageName: bills.packageName, periodStart: bills.periodStart,
        periodEnd: bills.periodEnd, dueDate: bills.dueDate,
        amount: bills.amount, taxPercent: bills.taxPercent,
        taxAmount: bills.taxAmount, totalAmount: bills.totalAmount,
        status: bills.status, createdAt: bills.createdAt,
      })
      .from(bills)
      .leftJoin(customers, eq(bills.customerId, customers.id))
      .where(eq(bills.tenantId, user.tenantId))
      .orderBy(desc(bills.createdAt));

    const headers = [
      'No. Tagihan', 'ID Pelanggan', 'Nama Pelanggan', 'Paket', 'Periode Mulai', 'Periode Akhir',
      'Jatuh Tempo', 'Harga Paket', '% PPN', 'PPN', 'Total', 'Status', 'Dibuat',
    ];
    const rows = all.map(b => [
      b.billNumber, String(b.customerId), b.customerName ?? '-', b.packageName,
      new Date(b.periodStart).toLocaleDateString('id-ID'),
      new Date(b.periodEnd).toLocaleDateString('id-ID'),
      new Date(b.dueDate).toLocaleDateString('id-ID'),
      b.amount, b.taxPercent ?? '0', b.taxAmount, b.totalAmount,
      b.status, new Date(b.createdAt).toLocaleDateString('id-ID'),
    ]);

    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
  }

  /**
   * Rencana "bayar di muka": periode-periode berikutnya yang akan dilunasi
   * `months` bulan ke depan. Dipakai untuk pratinjau DAN untuk eksekusi, supaya
   * yang dilihat admin persis yang dilakukan sistem.
   *
   * Urutannya: tagihan yang SUDAH ada tapi belum lunas (belum jatuh tempo) dilunasi
   * lebih dulu, sisanya dibuatkan tagihan baru untuk periode berikutnya (bulan demi
   * bulan, tidak pernah mundur ke periode yang sudah lewat).
   *
   * Ditolak (BadRequest, pesannya untuk admin) kalau pelanggan tidak aktif, belum
   * pernah punya tagihan, atau masih punya tagihan menunggak — itu urusan
   * "Tandai Lunas", bukan bayar di muka.
   */
  async planAdvancePayment(
    customerId: number,
    months: number,
    tenantId: string,
    today: Date = new Date(),
  ): Promise<AdvancePlan> {
    if (!Number.isInteger(months) || months < 1 || months > 12) {
      throw new BadRequestException('Jumlah bulan harus antara 1 dan 12');
    }

    const [customer] = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
      .limit(1);
    if (!customer) throw new NotFoundException('Pelanggan tidak ditemukan');
    if (customer.status !== 'active') {
      throw new BadRequestException(
        'Bayar di muka hanya untuk pelanggan aktif. Pelanggan isolir melunasi tagihan menunggaknya lebih dulu lewat "Tandai Lunas".',
      );
    }
    if (!customer.packageId) throw new BadRequestException('Pelanggan belum punya paket');

    const [pkg] = await this.db.select().from(packages).where(eq(packages.id, customer.packageId)).limit(1);
    if (!pkg) throw new NotFoundException('Paket pelanggan tidak ditemukan');

    const ymd = (col: typeof bills.periodStart | typeof bills.periodEnd | typeof bills.dueDate) =>
      sql<string>`DATE_FORMAT(${col}, '%Y-%m-%d')`;
    const existing = await this.db
      .select({
        id: bills.id,
        billNumber: bills.billNumber,
        status: bills.status,
        periodStart: ymd(bills.periodStart),
        periodEnd: ymd(bills.periodEnd),
        dueDate: ymd(bills.dueDate),
        amount: bills.amount,
        taxPercent: bills.taxPercent,
        taxAmount: bills.taxAmount,
        totalAmount: bills.totalAmount,
        packageName: bills.packageName,
      })
      .from(bills)
      .where(and(
        eq(bills.customerId, customerId),
        eq(bills.tenantId, tenantId),
        ne(bills.status, 'cancelled'),
      ))
      .orderBy(asc(bills.periodStart), asc(bills.id));

    if (existing.length === 0) {
      throw new BadRequestException(
        'Pelanggan ini belum punya tagihan sama sekali. Buat tagihan pertamanya lewat "Generate Tagihan" dulu.',
      );
    }

    const todayYmd = toYmd(today);
    const overdue = existing.find(
      (b) => b.status === 'overdue' || (b.status === 'unpaid' && b.dueDate < todayYmd),
    );
    if (overdue) {
      throw new BadRequestException(
        `Pelanggan masih punya tagihan menunggak (${overdue.billNumber}). Lunasi dulu lewat "Tandai Lunas".`,
      );
    }

    // Tagihan yang sudah ada, belum lunas, belum jatuh tempo → dilunasi dulu.
    const items: AdvancePlanItem[] = existing
      .filter((b) => b.status === 'unpaid')
      .slice(0, months)
      .map((b) => ({
        billId: b.id,
        billNumber: b.billNumber,
        periodStart: b.periodStart,
        periodEnd: b.periodEnd,
        dueDate: b.dueDate,
        amount: b.amount,
        taxPercent: b.taxPercent,
        taxAmount: b.taxAmount,
        totalAmount: b.totalAmount,
        packageName: b.packageName,
      }));

    const remaining = months - items.length;
    if (remaining > 0) {
      // Periode baru dimulai setelah tagihan terakhir, tetapi tidak pernah di masa lalu
      // (pelanggan yang lama terisolir tidak ditagih untuk bulan-bulan yang sudah lewat).
      const lastStart = parseYmd(existing[existing.length - 1].periodStart);
      const afterLast = new Date(lastStart.getFullYear(), lastStart.getMonth() + 1, customer.billingDate);
      const fromToday = firstBillingDateOnOrAfter(customer.billingDate, startOfDay(today));
      const first = afterLast >= fromToday ? afterLast : fromToday;
      const amounts = this.computeBillAmounts(customer, pkg);

      for (let i = 0; i < remaining; i++) {
        const period = periodFromStart(
          new Date(first.getFullYear(), first.getMonth() + i, customer.billingDate),
        );
        items.push({
          billId: null,
          billNumber: null,
          periodStart: toYmd(period.periodStart),
          periodEnd: toYmd(period.periodEnd),
          dueDate: toYmd(period.dueDate),
          ...amounts,
          packageName: pkg.name,
        });
      }
    }

    const totalAmount = items.reduce((sum, it) => sum + Number(it.totalAmount), 0).toFixed(2);
    return {
      customer: { id: customer.id, name: customer.name, phone: customer.phone, billingDate: customer.billingDate },
      items,
      totalAmount,
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────

  private calculatePeriod(billingDate: number, periodStart?: Date): BillPeriod {
    if (periodStart) return periodFromStart(periodStart);
    const today = new Date();
    return periodFromStart(new Date(today.getFullYear(), today.getMonth(), billingDate));
  }

  /** Harga paket + PPN pelanggan. Satu sumber untuk tagihan otomatis maupun bayar di muka. */
  computeBillAmounts(
    customer: { taxEnabled: boolean; taxPercent: string | null },
    pkg: { price: string },
  ) {
    const baseAmount = Number(pkg.price);
    const taxPercent = customer.taxEnabled ? Number(customer.taxPercent ?? 0) : 0;
    const taxAmount = taxPercent > 0 ? Number(((baseAmount * taxPercent) / 100).toFixed(2)) : 0;
    const totalAmount = baseAmount + taxAmount;
    return {
      amount: String(baseAmount),
      taxPercent: customer.taxEnabled ? String(taxPercent) : null,
      taxAmount: String(taxAmount),
      totalAmount: String(totalAmount),
    };
  }

  async generateBillNumber(
    tenantId: string,
    period: Date,
    db: SelectCapable = this.db,
  ): Promise<string> {
    const year = period.getFullYear();
    const month = String(period.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;

    const [lastBill] = await db
      .select({ billNumber: bills.billNumber })
      .from(bills)
      .where(and(eq(bills.tenantId, tenantId), like(bills.billNumber, `${prefix}%`)))
      .orderBy(desc(bills.billNumber))
      .limit(1);

    const lastSeq = lastBill ? parseInt(lastBill.billNumber.replace(prefix, ''), 10) : 0;
    return `${prefix}${String(lastSeq + 1).padStart(5, '0')}`;
  }
}