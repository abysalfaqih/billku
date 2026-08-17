import {
  Injectable, Inject, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { eq, and, count, desc, like } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { bills, customers, packages, tenants, payments } from '../../database/schema';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { QueryBillingDto } from './dto/query-billing.dto';
import { buildInvoicePdf } from './invoice-pdf.util';

@Injectable()
export class BillingService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  async generateManual(customerId: number, user: AuthUser) {
    return this.generateForCustomer(customerId, user.tenantId);
  }

  async generateForCustomer(customerId: number, tenantId: string) {
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

    const { periodStart, periodEnd, dueDate } = this.calculatePeriod(customer.billingDate);

    const [existing] = await this.db
      .select({ id: bills.id, status: bills.status })
      .from(bills)
      .where(and(eq(bills.customerId, customerId), eq(bills.tenantId, tenantId), eq(bills.periodStart, periodStart)))
      .limit(1);

    if (existing && existing.status !== 'cancelled') {
      throw new ConflictException('Tagihan untuk periode ini sudah ada');
    }

    const billNumber = await this.generateBillNumber(tenantId, periodStart);

    // ── Hitung PPN ────────────────────────────────────────────────
    const baseAmount = Number(pkg.price);
    const taxPercent = customer.taxEnabled ? Number(customer.taxPercent ?? 0) : 0;
    const taxAmount = taxPercent > 0 ? Number(((baseAmount * taxPercent) / 100).toFixed(2)) : 0;
    const totalAmount = baseAmount + taxAmount;

    const [result] = await this.db.insert(bills).values({
      tenantId, customerId, billNumber, periodStart, periodEnd, dueDate,
      amount: String(baseAmount),
      taxPercent: customer.taxEnabled ? String(taxPercent) : null,
      taxAmount: String(taxAmount),
      totalAmount: String(totalAmount),
      packageName: pkg.name,
    });

    return this.findOne(Number(result.insertId), { tenantId } as AuthUser);
  }

  async findAll(query: QueryBillingDto, user: AuthUser) {
    const { page = 1, limit = 20, status, customerId } = query;
    const offset = (page - 1) * limit;

    const where = and(
      eq(bills.tenantId, user.tenantId),
      status ? eq(bills.status, status) : undefined,
      customerId ? eq(bills.customerId, customerId) : undefined,
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
      this.db.select({ total: count() }).from(bills).where(where),
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
      .select({ id: customers.id, name: customers.name, phone: customers.phone, address: customers.address })
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

  // ─── Private Helpers ─────────────────────────────────────────────────

  private calculatePeriod(billingDate: number) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    return {
      periodStart: new Date(year, month, billingDate),
      periodEnd: new Date(year, month + 1, billingDate - 1),
      dueDate: new Date(year, month, billingDate),
    };
  }

  private async generateBillNumber(tenantId: string, period: Date): Promise<string> {
    const year = period.getFullYear();
    const month = String(period.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;

    const [lastBill] = await this.db
      .select({ billNumber: bills.billNumber })
      .from(bills)
      .where(and(eq(bills.tenantId, tenantId), like(bills.billNumber, `${prefix}%`)))
      .orderBy(desc(bills.billNumber))
      .limit(1);

    const lastSeq = lastBill ? parseInt(lastBill.billNumber.replace(prefix, ''), 10) : 0;
    return `${prefix}${String(lastSeq + 1).padStart(5, '0')}`;
  }
}