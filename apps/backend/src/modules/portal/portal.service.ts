import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import {
  tenants, customers, packages, areas, bills, payments,
} from '../../database/schema';

function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  const visible = 4;
  return phone.slice(0, visible) + '****' + phone.slice(-3);
}

function normalizePhone(raw: string): string[] {
  const digits = raw.replace(/\D/g, '');
  const variants = new Set<string>();

  variants.add(digits);
  if (digits.startsWith('0')) variants.add('62' + digits.slice(1));
  if (digits.startsWith('62')) variants.add('0' + digits.slice(2));
  if (digits.startsWith('8')) {
    variants.add('0' + digits);
    variants.add('62' + digits);
  }

  return Array.from(variants);
}

@Injectable()
export class PortalService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  // Info publik tenant — untuk tampilkan di halaman portal
  async getTenantInfo(slug: string) {
    const [tenant] = await this.db
      .select({
        id: tenants.id, name: tenants.name, logoUrl: tenants.logoUrl,
        motto: tenants.motto, phone: tenants.phone, email: tenants.email,
        address: tenants.address, isActive: tenants.isActive,
      })
      .from(tenants)
      .where(and(eq(tenants.slug, slug), eq(tenants.isActive, true)))
      .limit(1);

    if (!tenant) throw new NotFoundException('Halaman portal tidak ditemukan');
    return tenant;
  }

  // Lookup pelanggan berdasarkan nomor HP
  async lookupCustomer(slug: string, phone: string) {
    const tenant = await this.getTenantInfo(slug);

    // Normalisasi nomor HP — coba beberapa format
    const phoneVariants = normalizePhone(phone.trim());

    let customer: typeof customers.$inferSelect | undefined;
    for (const variant of phoneVariants) {
      const [found] = await this.db
        .select()
        .from(customers)
        .where(and(
          eq(customers.tenantId, tenant.id),
          eq(customers.phone, variant),
        ))
        .limit(1);
      if (found) { customer = found; break; }
    }

    if (!customer) {
      throw new NotFoundException(
        'Nomor tidak ditemukan. Pastikan nomor yang Anda masukkan sesuai dengan nomor yang terdaftar.',
      );
    }

    // Paket
    const [pkg] = customer.packageId
      ? await this.db
          .select({
            name: packages.name,
            speedDownload: packages.speedDownload,
            speedUpload: packages.speedUpload,
            price: packages.price,
          })
          .from(packages)
          .where(eq(packages.id, customer.packageId))
          .limit(1)
      : [null];

    // Area
    const [area] = customer.areaId
      ? await this.db
          .select({ name: areas.name })
          .from(areas)
          .where(eq(areas.id, customer.areaId))
          .limit(1)
      : [null];

    // Tagihan (terbaru 8)
    const billList = await this.db
      .select({
        id: bills.id,
        billNumber: bills.billNumber,
        periodStart: bills.periodStart,
        periodEnd: bills.periodEnd,
        dueDate: bills.dueDate,
        packageName: bills.packageName,
        amount: bills.amount,
        taxAmount: bills.taxAmount,
        totalAmount: bills.totalAmount,
        status: bills.status,
        createdAt: bills.createdAt,
      })
      .from(bills)
      .where(and(eq(bills.customerId, customer.id), eq(bills.tenantId, tenant.id)))
      .orderBy(desc(bills.createdAt))
      .limit(8);

    // Pembayaran (terbaru 10)
    const paymentList = await this.db
      .select({
        id: payments.id,
        paidAt: payments.paidAt,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        notes: payments.notes,
      })
      .from(payments)
      .where(and(eq(payments.customerId, customer.id), eq(payments.tenantId, tenant.id)))
      .orderBy(desc(payments.paidAt))
      .limit(10);

    // Tagihan aktif (unpaid / overdue)
    const activeBills = billList.filter(b => b.status === 'unpaid' || b.status === 'overdue');

    return {
      customer: {
        customerCode: customer.customerCode,
        name: customer.name,
        phone: maskPhone(customer.phone),
        address: customer.address,
        status: customer.status,
        billingDate: customer.billingDate,
        installationDate: customer.installationDate,
        area: area?.name ?? null,
      },
      package: pkg,
      activeBills,
      bills: billList,
      payments: paymentList,
      tenant: {
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        motto: tenant.motto,
        phone: tenant.phone,
        email: tenant.email,
        address: tenant.address,
      },
    };
  }
}