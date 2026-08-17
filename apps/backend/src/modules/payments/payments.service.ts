import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, count, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { payments, bills, customers } from '../../database/schema';
import { RadiusService } from '../radius/radius.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { WhatsappTemplatesService } from '../whatsapp-templates/whatsapp-templates.service';
import { formatRupiah } from '../whatsapp-templates/whatsapp-templates.defaults';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { QueryPaymentDto } from './dto/query-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private radiusService: RadiusService,
    private whatsappService: WhatsAppService,
    private whatsappTemplatesService: WhatsappTemplatesService,
  ) {}

  async create(dto: CreatePaymentDto, user: AuthUser) {
    const [bill] = await this.db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, dto.billId),
          eq(bills.tenantId, user.tenantId),
        ),
      )
      .limit(1);

    if (!bill) throw new NotFoundException('Tagihan tidak ditemukan');
    if (bill.status === 'paid') {
      throw new BadRequestException('Tagihan ini sudah dibayar');
    }
    if (bill.status === 'cancelled') {
      throw new BadRequestException('Tagihan yang dibatalkan tidak bisa dibayar');
    }

    // Ambil customer untuk cek PPPoE username
    const [customer] = await this.db
      .select({
        status: customers.status,
        usernamePppoe: customers.usernamePppoe,
        name: customers.name,      // ← tambahkan
        phone: customers.phone,    // ← tambahkan
      })
      .from(customers)
      .where(eq(customers.id, bill.customerId))
      .limit(1);

    // Buat record pembayaran
    const [result] = await this.db.insert(payments).values({
      tenantId: user.tenantId,
      billId: bill.id,
      customerId: bill.customerId,
      amount: bill.totalAmount,
      paymentMethod: dto.paymentMethod,
      notes: dto.notes,
      createdBy: user.userId,
    });

    // Update tagihan → paid
    await this.db
      .update(bills)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(eq(bills.id, bill.id));

    // Jika pelanggan sedang diisolir → aktifkan kembali
    if (customer?.status === 'isolated') {
      await this.db
        .update(customers)
        .set({ status: 'active', updatedAt: new Date() })
        .where(
          and(
            eq(customers.id, bill.customerId),
            eq(customers.status, 'isolated'),
          ),
        );

      // Enable di FreeRADIUS → pelanggan bisa reconnect PPPoE
      if (customer.usernamePppoe) {
        await this.radiusService.enableUser(customer.usernamePppoe);
      }
    }

    // Kirim WA notifikasi pembayaran
    const paidAtStr = new Date().toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    if (customer) {
      await this.whatsappService.queueNotification({
        tenantId: user.tenantId,
        phone: customer.phone,
        message: await this.whatsappTemplatesService.render(
          'payment',
          user.tenantId,
          {
            name: customer.name,
            billNumber: bill.billNumber,
            amount: formatRupiah(bill.totalAmount),
            paidAt: paidAtStr,
          },
        ),
        trigger: 'payment',
        customerId: bill.customerId,
        billId: bill.id,
      });
    }

    return this.findOne(Number(result.insertId), user);
  }

  async findAll(query: QueryPaymentDto, user: AuthUser) {
    const { page = 1, limit = 20, customerId } = query;
    const offset = (page - 1) * limit;

    const where = and(
      eq(payments.tenantId, user.tenantId),
      customerId ? eq(payments.customerId, customerId) : undefined,
    );

    const [data, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: payments.id,
          tenantId: payments.tenantId,
          billId: payments.billId,
          customerId: payments.customerId,
          customerName: customers.name, // ← BARU: sebelumnya tidak pernah di-select, makanya di FE cuma muncul ID
          amount: payments.amount,
          paymentMethod: payments.paymentMethod,
          paidAt: payments.paidAt,
          notes: payments.notes,
          createdBy: payments.createdBy,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .leftJoin(customers, eq(payments.customerId, customers.id))
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(payments.paidAt)),
      this.db.select({ total: count() }).from(payments).where(where),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number, user: AuthUser) {
    const [payment] = await this.db
      .select({
        id: payments.id,
        tenantId: payments.tenantId,
        billId: payments.billId,
        customerId: payments.customerId,
        customerName: customers.name, // ← BARU
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        paidAt: payments.paidAt,
        notes: payments.notes,
        createdBy: payments.createdBy,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(customers, eq(payments.customerId, customers.id))
      .where(
        and(
          eq(payments.id, id),
          eq(payments.tenantId, user.tenantId),
        ),
      )
      .limit(1);

    if (!payment) throw new NotFoundException(`Pembayaran #${id} tidak ditemukan`);
    return payment;
  }

  async exportCsv(user: AuthUser): Promise<string> {
    const all = await this.db
      .select({
        id: payments.id, billId: payments.billId, customerId: payments.customerId,
        customerName: customers.name, // ← BARU
        amount: payments.amount, paymentMethod: payments.paymentMethod,
        paidAt: payments.paidAt, notes: payments.notes,
      })
      .from(payments)
      .leftJoin(customers, eq(payments.customerId, customers.id))
      .where(eq(payments.tenantId, user.tenantId))
      .orderBy(desc(payments.paidAt));

    const headers = ['ID', 'ID Tagihan', 'ID Pelanggan', 'Nama Pelanggan', 'Jumlah', 'Metode', 'Waktu Bayar', 'Catatan'];
    const methodLabel: Record<string, string> = { cash: 'Tunai', transfer: 'Transfer', other: 'Lainnya' };
    const rows = all.map(p => [
      String(p.id), String(p.billId), String(p.customerId), p.customerName ?? '-',
      p.amount, methodLabel[p.paymentMethod] ?? p.paymentMethod,
      new Date(p.paidAt).toLocaleString('id-ID'),
      p.notes ?? '',
    ]);

    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
  }
}