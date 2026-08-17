import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { tenantInvoices, tenants } from '../../database/schema';
import { buildTenantInvoicePdf } from './tenant-invoice-pdf.util';
import type { CreateTenantInvoiceDto } from './dto/create-tenant-invoice.dto';

@Injectable()
export class TenantInvoicesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  private async generateInvoiceNumber(year: number, month: number): Promise<string> {
    const prefix = `SI/${String(year).slice(-2)}${String(month).padStart(2, '0')}-`;
    const [last] = await this.db
      .select({ invoiceNumber: tenantInvoices.invoiceNumber })
      .from(tenantInvoices)
      .where(and(
        eq(tenantInvoices.periodYear, year),
        eq(tenantInvoices.periodMonth, month),
      ))
      .orderBy(desc(tenantInvoices.invoiceNumber))
      .limit(1);

    const lastSeq = last
      ? parseInt(last.invoiceNumber.replace(prefix, ''), 10)
      : 0;

    return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateTenantInvoiceDto) {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, dto.tenantId))
      .limit(1);

    if (!tenant) throw new NotFoundException('Mitra tidak ditemukan');

    const invoiceNumber = await this.generateInvoiceNumber(dto.periodYear, dto.periodMonth);
    const invoiceDate   = new Date();

    // Hitung subtotal dari items
    const subtotal = dto.items.reduce((sum, item) => {
      return sum + (item.unitPrice * item.qty * (1 - item.discPercent / 100));
    }, 0);

    const ppnAmount    = Number(((subtotal * dto.ppnPercent) / 100).toFixed(2));
    const totalAmount  = subtotal - (dto.discountAmount ?? 0) + ppnAmount;

    const [result] = await this.db.insert(tenantInvoices).values({
      tenantId:           dto.tenantId,
      invoiceNumber,
      invoiceDate,
      periodMonth:        dto.periodMonth,
      periodYear:         dto.periodYear,
      items:              JSON.stringify(dto.items),
      subtotal:           String(subtotal),
      discountAmount:     String(dto.discountAmount ?? 0),
      ppnPercent:         String(dto.ppnPercent),
      ppnAmount:          String(ppnAmount),
      totalAmount:        String(totalAmount),
      paymentDescription: dto.paymentDescription,
      authorizedBy:       dto.authorizedBy,
      authorizedTitle:    dto.authorizedTitle,
      notes:              dto.notes,
      status:             'draft',
    });

    return this.findOne(Number(result.insertId));
  }

  async findAll(tenantId?: string) {
    const where = tenantId ? eq(tenantInvoices.tenantId, tenantId) : undefined;
    const rows = await this.db
      .select({
        id: tenantInvoices.id,
        invoiceNumber: tenantInvoices.invoiceNumber,
        invoiceDate: tenantInvoices.invoiceDate,
        periodMonth: tenantInvoices.periodMonth,
        periodYear: tenantInvoices.periodYear,
        totalAmount: tenantInvoices.totalAmount,
        status: tenantInvoices.status,
        tenantId: tenantInvoices.tenantId,
        tenantName: tenants.name,
      })
      .from(tenantInvoices)
      .leftJoin(tenants, eq(tenantInvoices.tenantId, tenants.id))
      .where(where)
      .orderBy(desc(tenantInvoices.createdAt));

    return rows;
  }

  async findOne(id: number) {
    const [inv] = await this.db
      .select()
      .from(tenantInvoices)
      .where(eq(tenantInvoices.id, id))
      .limit(1);

    if (!inv) throw new NotFoundException('Invoice tidak ditemukan');
    return { ...inv, items: JSON.parse(inv.items) };
  }

  async updateStatus(id: number, status: 'draft' | 'sent' | 'paid') {
    await this.findOne(id);
    await this.db
      .update(tenantInvoices)
      .set({ status, updatedAt: new Date() })
      .where(eq(tenantInvoices.id, id));
    return this.findOne(id);
  }

  async generateAutoFromBandwidth(tenantId: string, periodMonth: number, periodYear: number, dto: Partial<CreateTenantInvoiceDto>) {
    const [tenant] = await this.db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant) throw new NotFoundException('Mitra tidak ditemukan');
    if (!tenant.bandwidthEnabled) throw new NotFoundException('Bandwidth tidak diaktifkan untuk mitra ini');

    const periodNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                         'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    return this.create({
      tenantId,
      periodMonth,
      periodYear,
      items: [{
        description: `${tenant.bandwidthDescription ?? 'Layanan Bandwidth'} Periode ${periodNames[periodMonth]} ${periodYear}`,
        qty: 1,
        unitPrice: Number(tenant.bandwidthPriceMonthly ?? 0),
        discPercent: 0,
        tax: 'P',
      }],
      ppnPercent:   dto.ppnPercent ?? 11,
      discountAmount: 0,
      paymentDescription: dto.paymentDescription,
      authorizedBy:    dto.authorizedBy,
      authorizedTitle: dto.authorizedTitle,
    });
  }

  async generatePdf(id: number, issuerTenant: {
    name: string; address: string | null; phone: string; email: string; logoUrl?: string | null;
  }): Promise<Buffer> {
    const inv = await this.findOne(id);

    const [tenant] = await this.db
      .select({ name: tenants.name, address: tenants.address })
      .from(tenants)
      .where(eq(tenants.id, inv.tenantId))
      .limit(1);

    return buildTenantInvoicePdf({
      issuer: {
        name:    issuerTenant.name,
        address: issuerTenant.address ?? '',
        phone:   issuerTenant.phone,
        email:   issuerTenant.email,
        logoUrl: issuerTenant.logoUrl,
      },
      tenant: {
        name:    tenant?.name ?? '-',
        address: tenant?.address ?? null,
      },
      invoice: {
        invoiceNumber:      inv.invoiceNumber,
        invoiceDate:        new Date(inv.invoiceDate),
        periodMonth:        inv.periodMonth,
        periodYear:         inv.periodYear,
        items:              inv.items,
        subtotal:           Number(inv.subtotal),
        discountAmount:     Number(inv.discountAmount),
        ppnPercent:         Number(inv.ppnPercent),
        ppnAmount:          Number(inv.ppnAmount),
        totalAmount:        Number(inv.totalAmount),
        paymentDescription: inv.paymentDescription,
        authorizedBy:       inv.authorizedBy,
        authorizedTitle:    inv.authorizedTitle,
      },
    });
  }
}