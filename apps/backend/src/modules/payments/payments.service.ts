import {
  Injectable,
  Inject,
  HttpException,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, count, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { payments, bills, customers } from '../../database/schema';
import { CustomersService } from '../customers/customers.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { WhatsappTemplatesService } from '../whatsapp-templates/whatsapp-templates.service';
import { formatRupiah } from '../whatsapp-templates/whatsapp-templates.defaults';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { QueryPaymentDto } from './dto/query-payment.dto';

/**
 * Hasil pengaktifan kembali pelanggan isolir saat tagihan ditandai lunas.
 *  - not_needed : pelanggan tidak sedang isolir
 *  - reactivated: koneksi sudah dipulihkan DAN status pelanggan kembali 'active'
 *  - failed     : pembayaran tetap tercatat, tapi koneksi gagal dipulihkan
 *                 (router/RADIUS tidak terjangkau) → status pelanggan TETAP 'isolated'
 */
export type ReactivationResult =
  | { status: 'not_needed' }
  | { status: 'reactivated' }
  | { status: 'failed'; message: string };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private customersService: CustomersService,
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

    // Ambil customer: status & data akun jaringan (untuk pengaktifan kembali
    // kalau sedang isolir) + nama/HP untuk notifikasi WA
    const [customer] = await this.db
      .select({
        status: customers.status,
        connectionType: customers.connectionType,
        mikrotikConfigId: customers.mikrotikConfigId,
        usernamePppoe: customers.usernamePppoe,
        name: customers.name,
        phone: customers.phone,
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

    // Jika pelanggan sedang diisolir → aktifkan kembali (koneksi + status)
    let reactivation: ReactivationResult = { status: 'not_needed' };
    if (customer?.status === 'isolated') {
      reactivation = await this.reactivateIsolatedCustomer(bill.customerId, user.tenantId, customer);
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

    const payment = await this.findOne(Number(result.insertId), user);
    return { ...payment, reactivation };
  }

  /**
   * Pulihkan koneksi pelanggan isolir yang baru melunasi tagihan.
   *
   * Urutan sengaja: koneksi (Mikrotik/RADIUS) dipulihkan DULU, baru status di
   * database diubah ke 'active'. Dengan begitu status 'active' berarti internet
   * memang sudah dibuka — bukan cuma label di database. Kalau pemulihan koneksi
   * gagal, status dibiarkan 'isolated' (pembayaran tetap tercatat) dan pemanggil
   * diberi tahu lewat hasil 'failed'; admin bisa mencoba lagi lewat
   * Edit Pelanggan → Status → Aktif, yang memakai jalur pemulihan yang sama.
   */
  private async reactivateIsolatedCustomer(
    customerId: number,
    tenantId: string,
    customer: {
      connectionType: 'pppoe' | 'hotspot';
      mikrotikConfigId: number | null;
      usernamePppoe: string | null;
    },
  ): Promise<ReactivationResult> {
    try {
      await this.customersService.enableNetworkAccess({ ...customer, tenantId });
    } catch (err) {
      this.logger.error(
        `Gagal mengaktifkan kembali koneksi '${customer.usernamePppoe ?? customerId}' setelah pembayaran: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // Pesan error mentah dari driver (Drizzle/RouterOS) bisa memuat SQL/host —
      // cukup tampilkan pesan yang memang ditulis untuk admin (HttpException),
      // detail lengkapnya sudah ada di log server.
      return {
        status: 'failed',
        message: err instanceof HttpException ? err.message : 'Mikrotik/RADIUS tidak dapat dihubungi',
      };
    }

    await this.db
      .update(customers)
      .set({ status: 'active', updatedAt: new Date() })
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.tenantId, tenantId),
          eq(customers.status, 'isolated'),
        ),
      );

    return { status: 'reactivated' };
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