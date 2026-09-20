import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { tenantInvoices, tenants } from '../../database/schema';
import { buildTenantInvoicePdf } from './tenant-invoice-pdf.util';
import type { CreateTenantInvoiceDto } from './dto/create-tenant-invoice.dto';
import type { UpdateTenantInvoiceDto } from './dto/update-tenant-invoice.dto';

type InvoiceItem = {
  description: string;
  qty: number;
  unitPrice: number;
  discPercent: number;
  tax: 'P' | 'N';
};

@Injectable()
export class TenantInvoicesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  private async generateInvoiceNumber(
    year: number,
    month: number,
  ): Promise<string> {
    const prefix = `SI/${String(year).slice(-2)}${String(month).padStart(2, '0')}-`;
    const [last] = await this.db
      .select({ invoiceNumber: tenantInvoices.invoiceNumber })
      .from(tenantInvoices)
      .where(
        and(
          eq(tenantInvoices.periodYear, year),
          eq(tenantInvoices.periodMonth, month),
        ),
      )
      .orderBy(desc(tenantInvoices.invoiceNumber))
      .limit(1);

    const lastSeq = last
      ? parseInt(last.invoiceNumber.replace(prefix, ''), 10)
      : 0;

    return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
  }

  // Hitung subtotal, PPN, dan total dari items — dipakai bareng oleh create() & update()
  // supaya rumusnya tidak pernah berbeda antara keduanya.
  private calculateTotals(
    items: InvoiceItem[],
    ppnPercent: number,
    discountAmount: number,
  ) {
    const subtotal = items.reduce((sum, item) => {
      return sum + item.unitPrice * item.qty * (1 - item.discPercent / 100);
    }, 0);

    const ppnAmount = Number(((subtotal * ppnPercent) / 100).toFixed(2));
    const totalAmount = subtotal - discountAmount + ppnAmount;

    return { subtotal, ppnAmount, totalAmount };
  }

  async create(dto: CreateTenantInvoiceDto) {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, dto.tenantId))
      .limit(1);

    if (!tenant) throw new NotFoundException('Mitra tidak ditemukan');

    const invoiceNumber = await this.generateInvoiceNumber(
      dto.periodYear,
      dto.periodMonth,
    );
    const invoiceDate = new Date();

    const { subtotal, ppnAmount, totalAmount } = this.calculateTotals(
      dto.items,
      dto.ppnPercent,
      dto.discountAmount ?? 0,
    );

    const [result] = await this.db.insert(tenantInvoices).values({
      tenantId: dto.tenantId,
      invoiceNumber,
      invoiceDate,
      periodMonth: dto.periodMonth,
      periodYear: dto.periodYear,
      items: JSON.stringify(dto.items),
      subtotal: String(subtotal),
      discountAmount: String(dto.discountAmount ?? 0),
      ppnPercent: String(dto.ppnPercent),
      ppnAmount: String(ppnAmount),
      totalAmount: String(totalAmount),
      paymentDescription: dto.paymentDescription,
      authorizedBy: dto.authorizedBy,
      authorizedTitle: dto.authorizedTitle,
      notes: dto.notes,
      status: 'draft',
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

  // Edit invoice mitra. tenantId tidak bisa diubah lewat sini (lihat catatan di DTO).
  // Kalau items/ppnPercent/discountAmount berubah, subtotal-ppn-total dihitung ULANG
  // dari data terbaru (bukan dari nilai yang dikirim klien) supaya angka di invoice
  // tidak pernah tidak-sinkron dengan item-itemnya.
  async update(id: number, dto: UpdateTenantInvoiceDto) {
    const existing = await this.findOne(id);

    const items: InvoiceItem[] = dto.items ?? (existing.items as InvoiceItem[]);
    const ppnPercent = dto.ppnPercent ?? Number(existing.ppnPercent);
    const discountAmount =
      dto.discountAmount ?? Number(existing.discountAmount);

    const { subtotal, ppnAmount, totalAmount } = this.calculateTotals(
      items,
      ppnPercent,
      discountAmount,
    );

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      items: JSON.stringify(items),
      subtotal: String(subtotal),
      discountAmount: String(discountAmount),
      ppnPercent: String(ppnPercent),
      ppnAmount: String(ppnAmount),
      totalAmount: String(totalAmount),
    };

    if (dto.periodMonth !== undefined) updateData.periodMonth = dto.periodMonth;
    if (dto.periodYear !== undefined) updateData.periodYear = dto.periodYear;
    if (dto.paymentDescription !== undefined)
      updateData.paymentDescription = dto.paymentDescription;
    if (dto.authorizedBy !== undefined)
      updateData.authorizedBy = dto.authorizedBy;
    if (dto.authorizedTitle !== undefined)
      updateData.authorizedTitle = dto.authorizedTitle;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.status !== undefined) updateData.status = dto.status;

    await this.db
      .update(tenantInvoices)
      .set(updateData)
      .where(eq(tenantInvoices.id, id));
    return this.findOne(id);
  }

  // Hapus invoice mitra secara permanen. Invoice ini murni catatan tagihan
  // platform ke mitra (tidak direferensikan tabel lain), jadi hapusnya berdiri
  // sendiri tanpa perlu transaksi cascading seperti hapus tenant/pelanggan.
  async remove(id: number) {
    const existing = await this.findOne(id);
    await this.db.delete(tenantInvoices).where(eq(tenantInvoices.id, id));
    return {
      message: `Invoice '${existing.invoiceNumber}' berhasil dihapus permanen`,
    };
  }

  async generateAutoFromBandwidth(
    tenantId: string,
    periodMonth: number,
    periodYear: number,
    dto: Partial<CreateTenantInvoiceDto>,
  ) {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!tenant) throw new NotFoundException('Mitra tidak ditemukan');
    if (!tenant.bandwidthEnabled)
      throw new NotFoundException('Bandwidth tidak diaktifkan untuk mitra ini');

    const periodNames = [
      '',
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];

    return this.create({
      tenantId,
      periodMonth,
      periodYear,
      items: [
        {
          description: `${tenant.bandwidthDescription ?? 'Layanan Bandwidth'} Periode ${periodNames[periodMonth]} ${periodYear}`,
          qty: 1,
          unitPrice: Number(tenant.bandwidthPriceMonthly ?? 0),
          discPercent: 0,
          tax: 'P',
        },
      ],
      ppnPercent: dto.ppnPercent ?? 11,
      discountAmount: 0,
      paymentDescription: dto.paymentDescription,
      authorizedBy: dto.authorizedBy,
      authorizedTitle: dto.authorizedTitle,
    });
  }

  async generatePdf(
    id: number,
    issuerTenant: {
      name: string;
      address: string | null;
      phone: string;
      email: string;
      logoUrl?: string | null;
    },
  ): Promise<Buffer> {
    const inv = await this.findOne(id);

    const [tenant] = await this.db
      .select({ name: tenants.name, address: tenants.address })
      .from(tenants)
      .where(eq(tenants.id, inv.tenantId))
      .limit(1);

    return buildTenantInvoicePdf({
      issuer: {
        name: issuerTenant.name,
        address: issuerTenant.address ?? '',
        phone: issuerTenant.phone,
        email: issuerTenant.email,
        logoUrl: issuerTenant.logoUrl,
      },
      tenant: {
        name: tenant?.name ?? '-',
        address: tenant?.address ?? null,
      },
      invoice: {
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: new Date(inv.invoiceDate),
        periodMonth: inv.periodMonth,
        periodYear: inv.periodYear,
        items: inv.items,
        subtotal: Number(inv.subtotal),
        discountAmount: Number(inv.discountAmount),
        ppnPercent: Number(inv.ppnPercent),
        ppnAmount: Number(inv.ppnAmount),
        totalAmount: Number(inv.totalAmount),
        paymentDescription: inv.paymentDescription,
        authorizedBy: inv.authorizedBy,
        authorizedTitle: inv.authorizedTitle,
      },
    });
  }
}
