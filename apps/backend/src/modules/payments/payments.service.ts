import {
  Injectable,
  Inject,
  HttpException,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, or, ne, count, desc, like, asc, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { payments, bills, customers, users } from '../../database/schema';
import { CustomersService } from '../customers/customers.service';
import { BillingService } from '../billing/billing.service';
import { parseYmd, periodFromStart } from '../billing/billing-period.util';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { WhatsappTemplatesService } from '../whatsapp-templates/whatsapp-templates.service';
import {
  formatRupiah,
  formatTanggal,
  paymentKeterangan,
} from '../whatsapp-templates/whatsapp-templates.defaults';
import type { PaymentNoteKind } from '../whatsapp-templates/whatsapp-templates.defaults';
import { ymdInAppTz } from '../../common/utils/app-time.util';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { QueryPaymentDto } from './dto/query-payment.dto';
import type { AdvancePreviewDto, CreateAdvancePaymentDto } from './dto/advance-payment.dto';

/**
 * Hasil pengaktifan kembali pelanggan isolir saat tagihan ditandai lunas.
 *  - not_needed : pelanggan tidak sedang isolir
 *  - reactivated: koneksi sudah dipulihkan DAN status pelanggan kembali 'active'
 *  - failed     : pembayaran tetap tercatat, tapi koneksi gagal dipulihkan
 *                 (router/RADIUS tidak terjangkau) → status pelanggan TETAP 'isolated'
 *  - blocked    : pembayaran tercatat, tetapi pelanggan masih punya tagihan LAIN yang
 *                 sudah lewat jatuh tempo → koneksi/status tidak diubah. Layanan baru
 *                 dibuka setelah SEMUA tagihan menunggak lunas (atau dibatalkan admin).
 */
export type ReactivationResult =
  | { status: 'not_needed' }
  | { status: 'reactivated' }
  | { status: 'failed'; message: string }
  | { status: 'blocked'; remaining: { billNumber: string; totalAmount: string; dueDate: string }[] };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private customersService: CustomersService,
    private whatsappService: WhatsAppService,
    private whatsappTemplatesService: WhatsappTemplatesService,
    private billingService: BillingService,
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
      .where(and(eq(customers.id, bill.customerId), eq(customers.tenantId, user.tenantId)))
      .limit(1);

    // Pembayaran + pelunasan tagihan dalam SATU transaksi, dan pelunasan dijaga
    // oleh kondisi status. Dulu keduanya terpisah tanpa penjagaan: klik ganda /
    // dua admin yang memproses tagihan yang sama menghasilkan DUA catatan bayar
    // untuk satu tagihan (laporan pemasukan membengkak), dan kegagalan di
    // tengah meninggalkan pembayaran tercatat tapi tagihan masih "belum lunas" —
    // tagihan itu lalu tetap kena isolir/pengingat padahal pelanggan sudah bayar.
    const paymentId = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(bills)
        .set({ status: 'paid', updatedAt: new Date() })
        .where(
          and(
            eq(bills.id, bill.id),
            eq(bills.tenantId, user.tenantId),
            inArray(bills.status, ['unpaid', 'overdue']),
          ),
        );
      if (!updated || updated.affectedRows !== 1) {
        throw new ConflictException(
          'Tagihan ini baru saja dibayar atau berubah status. Muat ulang halaman untuk melihat data terbaru.',
        );
      }

      const [inserted] = await tx.insert(payments).values({
        tenantId: user.tenantId,
        billId: bill.id,
        customerId: bill.customerId,
        amount: bill.totalAmount,
        paymentMethod: dto.paymentMethod,
        notes: dto.notes,
        createdBy: user.userId,
      });
      return Number(inserted.insertId);
    });

    // Tagihan LAIN milik pelanggan ini yang sudah lewat jatuh tempo dan belum lunas.
    // Satu pelanggan bisa menunggak lebih dari satu tagihan (data lama, atau tagihan
    // yang dibuat manual). Membayar salah satunya TIDAK boleh langsung membuka
    // layanan: kalau dibuka, isolir malam itu memutusnya lagi dan pelanggan
    // mengira sudah bayar tapi internetnya mati lagi.
    const remaining = customer ? await this.findPastDueBills(bill.customerId, user.tenantId) : [];

    let reactivation: ReactivationResult = { status: 'not_needed' };
    if (customer?.status === 'isolated') {
      reactivation =
        remaining.length > 0
          ? { status: 'blocked', remaining }
          : await this.reactivateIsolatedCustomer(bill.customerId, user.tenantId, customer);
    } else if (customer?.status === 'active' && customer.connectionType === 'pppoe' && bill.status === 'overdue') {
      if (remaining.length > 0) {
        // Blokir RADIUS yang mungkin tertinggal sengaja dibiarkan: pelanggan ini
        // memang masih menunggak dan akan diisolir pada proses berikutnya.
        reactivation = { status: 'blocked', remaining };
      } else {
        // Isolir otomatis memblokir akun di RADIUS LEBIH DULU, baru memutus sesi di
        // router dan baru mengubah status jadi 'isolated'. Kalau router tidak
        // terjangkau saat itu, pelanggan sengaja tetap 'active' (dicoba lagi malam
        // berikutnya) — padahal blokir RADIUS-nya sudah terpasang. Tanpa langkah ini,
        // pelanggan yang membayar di sela-sela itu tidak akan pernah dibuka lagi.
        await this.releaseLingeringRadiusBlock(bill.customerId, user.tenantId, customer);
      }
    }

    // Notifikasi WA — pembayaran sudah tersimpan, jadi kegagalan di sini (render
    // template, antrean) tidak boleh membuat API menjawab error: admin akan
    // mengulang dan malah ditolak "sudah dibayar".
    if (customer) {
      try {
        let note: PaymentNoteKind;
        if (reactivation.status === 'reactivated') note = { kind: 'reactivated' };
        else if (reactivation.status === 'failed') note = { kind: 'pending-activation' };
        else if (remaining.length > 0) {
          note = {
            kind: 'arrears',
            billNumbers: remaining.map((r) => r.billNumber),
            isolated: customer.status === 'isolated',
          };
        } else note = { kind: 'thanks' };

        await this.whatsappService.queueNotification({
          tenantId: user.tenantId,
          phone: customer.phone,
          message: await this.whatsappTemplatesService.render('payment', user.tenantId, {
            name: customer.name,
            billNumber: bill.billNumber,
            amount: formatRupiah(bill.totalAmount),
            paidAt: formatTanggal(ymdInAppTz()),
            keterangan: paymentKeterangan(note),
          }),
          trigger: 'payment',
          customerId: bill.customerId,
          billId: bill.id,
        });
      } catch (err) {
        this.logger.error(`WA konfirmasi bayar gagal diantrekan: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const payment = await this.findOne(paymentId, user);
    return { ...payment, reactivation };
  }

  /** Tagihan belum lunas yang jatuh temponya sudah lewat (menurut tanggal WIB), terlama dulu. */
  private async findPastDueBills(customerId: number, tenantId: string) {
    return this.db
      .select({
        billNumber: bills.billNumber,
        totalAmount: bills.totalAmount,
        dueDate: sql<string>`DATE_FORMAT(${bills.dueDate}, '%Y-%m-%d')`,
      })
      .from(bills)
      .where(
        and(
          eq(bills.customerId, customerId),
          eq(bills.tenantId, tenantId),
          inArray(bills.status, ['unpaid', 'overdue']),
          sql`${bills.dueDate} < ${ymdInAppTz()}`,
        ),
      )
      .orderBy(asc(bills.dueDate), asc(bills.id));
  }

  // ─── Bayar di muka ─────────────────────────────────────────────────────────

  /** Pratinjau: periode apa saja yang akan dilunasi dan berapa totalnya. */
  previewAdvance(query: AdvancePreviewDto, user: AuthUser) {
    return this.billingService.planAdvancePayment(query.customerId, query.months, user.tenantId);
  }

  /**
   * Pelanggan membayar `months` periode ke depan sekaligus. Tiap periode yang belum
   * punya tagihan dibuatkan tagihannya (langsung berstatus lunas), tiap tagihan
   * belum-lunas-belum-jatuh-tempo yang sudah ada dilunasi, dan setiap periode
   * mendapat satu catatan pembayaran. Semua dalam satu transaksi: berhasil semua
   * atau tidak sama sekali.
   *
   * Tagihan otomatis (scheduler) melewati periode yang sudah punya tagihan, jadi
   * tidak akan terbit dobel; pengingat dan isolir hanya menyentuh tagihan belum
   * lunas, jadi pelanggan ini tidak diganggu.
   */
  async createAdvance(dto: CreateAdvancePaymentDto, user: AuthUser) {
    const plan = await this.billingService.planAdvancePayment(
      dto.customerId,
      dto.months,
      user.tenantId,
    );

    // Pratinjau yang dilihat admin harus masih sama dengan rencana sekarang.
    if (plan.items[0].periodStart !== dto.fromPeriodStart) {
      throw new ConflictException(
        'Data pelanggan berubah sejak pratinjau dibuka (mungkin sudah ada pembayaran lain). ' +
          'Tutup lalu buka lagi dialog ini untuk melihat periode terbaru.',
      );
    }

    const notes = dto.notes?.trim() ? `Bayar di muka — ${dto.notes.trim()}` : 'Bayar di muka';

    const recorded = await this.db.transaction(async (tx) => {
      const out: { billId: number; billNumber: string; periodStart: string; amount: string }[] = [];

      for (const item of plan.items) {
        let billId = item.billId;
        let billNumber = item.billNumber;

        if (billId === null) {
          const start = parseYmd(item.periodStart);

          // Jaga sekali lagi di dalam transaksi: periode ini belum boleh punya tagihan.
          const [dupe] = await tx
            .select({ id: bills.id })
            .from(bills)
            .where(
              and(
                eq(bills.customerId, dto.customerId),
                eq(bills.tenantId, user.tenantId),
                eq(bills.periodStart, start),
                ne(bills.status, 'cancelled'),
              ),
            )
            .limit(1);
          if (dupe) {
            throw new ConflictException(`Periode ${item.periodStart} sudah punya tagihan. Muat ulang pratinjau.`);
          }

          billNumber = await this.billingService.generateBillNumber(user.tenantId, start, tx);
          const period = periodFromStart(start);
          const [inserted] = await tx.insert(bills).values({
            tenantId: user.tenantId,
            customerId: dto.customerId,
            billNumber,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            dueDate: period.dueDate,
            amount: item.amount,
            taxPercent: item.taxPercent,
            taxAmount: item.taxAmount,
            totalAmount: item.totalAmount,
            packageName: item.packageName,
            status: 'paid',
            notes: 'Dibayar di muka',
          });
          billId = Number(inserted.insertId);
        } else {
          const [updated] = await tx
            .update(bills)
            .set({ status: 'paid', updatedAt: new Date() })
            .where(
              and(
                eq(bills.id, billId),
                eq(bills.tenantId, user.tenantId),
                eq(bills.status, 'unpaid'),
              ),
            );
          if (!updated || updated.affectedRows !== 1) {
            throw new ConflictException(
              `Tagihan ${billNumber} berubah saat diproses. Muat ulang pratinjau lalu coba lagi.`,
            );
          }
        }

        await tx.insert(payments).values({
          tenantId: user.tenantId,
          billId,
          customerId: dto.customerId,
          amount: item.totalAmount,
          paymentMethod: dto.paymentMethod,
          notes,
          createdBy: user.userId,
        });

        out.push({ billId, billNumber: billNumber as string, periodStart: item.periodStart, amount: item.totalAmount });
      }

      return out;
    });

    // Konfirmasi WA — satu pesan untuk seluruh pembayaran. Gagal mengantre tidak
    // membatalkan pembayaran yang sudah tersimpan.
    try {
      const first = recorded[0].billNumber;
      const last = recorded[recorded.length - 1].billNumber;
      await this.whatsappService.queueNotification({
        tenantId: user.tenantId,
        phone: plan.customer.phone,
        message: await this.whatsappTemplatesService.render('payment', user.tenantId, {
          name: plan.customer.name,
          billNumber: first === last ? first : `${first} s/d ${last}`,
          amount: formatRupiah(plan.totalAmount),
          paidAt: formatTanggal(ymdInAppTz()),
          keterangan: paymentKeterangan({ kind: 'thanks' }),
        }),
        trigger: 'payment',
        customerId: dto.customerId,
        billId: recorded[0].billId,
      });
    } catch (err) {
      this.logger.error(`WA konfirmasi bayar di muka gagal diantrekan: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      customerId: dto.customerId,
      months: dto.months,
      totalAmount: plan.totalAmount,
      payments: recorded,
    };
  }

  /**
   * Cabut blokir RADIUS yang mungkin tertinggal pada pelanggan berstatus 'active'
   * yang baru melunasi tagihan menunggak. Aman dijalankan walau tidak ada blokir
   * (menghapus baris yang tidak ada = tidak berbuat apa-apa). Best-effort: gagal
   * hanya dicatat di log, tidak menggagalkan pencatatan pembayaran.
   */
  private async releaseLingeringRadiusBlock(
    customerId: number,
    tenantId: string,
    customer: {
      connectionType: 'pppoe' | 'hotspot';
      mikrotikConfigId: number | null;
      usernamePppoe: string | null;
    },
  ): Promise<void> {
    try {
      await this.customersService.enableNetworkAccess({ ...customer, tenantId });
    } catch (err) {
      this.logger.error(
        `Gagal mencabut blokir RADIUS '${customer.usernamePppoe ?? customerId}' setelah pembayaran: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
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
    const { page = 1, limit = 20, customerId, search } = query;
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
      eq(payments.tenantId, user.tenantId),
      customerId ? eq(payments.customerId, customerId) : undefined,
      searchCondition,
    );

    const [data, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: payments.id,
          tenantId: payments.tenantId,
          billId: payments.billId,
          billNumber: bills.billNumber,
          customerId: payments.customerId,
          customerName: customers.name, // ← BARU: sebelumnya tidak pernah di-select, makanya di FE cuma muncul ID
          amount: payments.amount,
          paymentMethod: payments.paymentMethod,
          paidAt: payments.paidAt,
          notes: payments.notes,
          createdBy: payments.createdBy,
          createdByName: users.name,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .leftJoin(customers, eq(payments.customerId, customers.id))
        .leftJoin(bills, eq(payments.billId, bills.id))
        .leftJoin(users, eq(payments.createdBy, users.id))
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(payments.paidAt)),
      // join customers & bills juga di sini: kondisi pencarian memakai kolomnya
      this.db
        .select({ total: count() })
        .from(payments)
        .leftJoin(customers, eq(payments.customerId, customers.id))
        .leftJoin(bills, eq(payments.billId, bills.id))
        .where(where),
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