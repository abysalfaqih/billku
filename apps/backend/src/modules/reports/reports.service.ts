import { Injectable, Inject } from '@nestjs/common';
import { eq, and, count, sql, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { payments, bills, customers } from '../../database/schema';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { ReportPeriodDto } from './dto/report-period.dto';

@Injectable()
export class ReportsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  // ─── Pendapatan ───────────────────────────────────────────────────────

  async getRevenue(query: ReportPeriodDto, user: AuthUser) {
    const { startDate, endDate } = this.normalizePeriod(query);

    // Total keseluruhan
    const [summary] = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
        count: count(),
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, user.tenantId),
          sql`DATE(${payments.paidAt}) >= ${startDate}`,
          sql`DATE(${payments.paidAt}) <= ${endDate}`,
        ),
      );

    // Breakdown harian
    const daily = await this.db
      .select({
        date: sql<string>`DATE(${payments.paidAt})`,
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
        count: count(),
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, user.tenantId),
          sql`DATE(${payments.paidAt}) >= ${startDate}`,
          sql`DATE(${payments.paidAt}) <= ${endDate}`,
        ),
      )
      .groupBy(sql`DATE(${payments.paidAt})`)
      .orderBy(sql`DATE(${payments.paidAt})`);

    // Breakdown per metode pembayaran
    const byMethod = await this.db
      .select({
        method: payments.paymentMethod,
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
        count: count(),
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, user.tenantId),
          sql`DATE(${payments.paidAt}) >= ${startDate}`,
          sql`DATE(${payments.paidAt}) <= ${endDate}`,
        ),
      )
      .groupBy(payments.paymentMethod);

    return {
      period: { startDate, endDate },
      summary: {
        total: Number(summary.total ?? 0),
        count: summary.count,
      },
      daily,
      byMethod,
    };
  }

  // ─── Tagihan ──────────────────────────────────────────────────────────

  async getBillsSummary(user: AuthUser) {
    const byStatus = await this.db
      .select({
        status: bills.status,
        count: count(),
        total: sql<string>`COALESCE(SUM(${bills.totalAmount}), 0)`,
      })
      .from(bills)
      .where(eq(bills.tenantId, user.tenantId))
      .groupBy(bills.status);

    // Tagihan jatuh tempo hari ini yang belum dibayar
    const [overdueToday] = await this.db
      .select({ count: count() })
      .from(bills)
      .where(
        and(
          eq(bills.tenantId, user.tenantId),
          eq(bills.status, 'unpaid'),
          sql`DATE(${bills.dueDate}) = CURDATE()`,
        ),
      );

    return {
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: s.count,
        total: Number(s.total ?? 0),
      })),
      overdueToday: overdueToday.count,
    };
  }

  // ─── Pelanggan ────────────────────────────────────────────────────────

  async getCustomersSummary(user: AuthUser) {
    const byStatus = await this.db
      .select({
        status: customers.status,
        count: count(),
      })
      .from(customers)
      .where(eq(customers.tenantId, user.tenantId))
      .groupBy(customers.status);

    // Total keseluruhan
    const [total] = await this.db
      .select({ count: count() })
      .from(customers)
      .where(eq(customers.tenantId, user.tenantId));

    // Pelanggan baru bulan ini
    const [newThisMonth] = await this.db
      .select({ count: count() })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, user.tenantId),
          sql`MONTH(${customers.createdAt}) = MONTH(CURDATE())`,
          sql`YEAR(${customers.createdAt}) = YEAR(CURDATE())`,
        ),
      );

    return {
      total: total.count,
      newThisMonth: newThisMonth.count,
      byStatus,
    };
  }

  // ─── Dashboard Summary (semua dalam 1 call) ───────────────────────────

  async getDashboard(user: AuthUser) {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = today.substring(0, 8) + '01';

    const [revenue, bills_, customers_] = await Promise.all([
      this.getRevenue({ startDate: firstOfMonth, endDate: today }, user),
      this.getBillsSummary(user),
      this.getCustomersSummary(user),
    ]);

    return {
      revenue,
      bills: bills_,
      customers: customers_,
    };
  }

  async getMonthlyReport(year: number, user: AuthUser) {
    // Revenue per bulan
    const revenueByMonth = await this.db
      .select({
        month: sql<string>`DATE_FORMAT(${payments.paidAt}, '%Y-%m')`,
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
        count: count(),
      })
      .from(payments)
      .where(and(
        eq(payments.tenantId, user.tenantId),
        sql`YEAR(${payments.paidAt}) = ${year}`,
      ))
      .groupBy(sql`DATE_FORMAT(${payments.paidAt}, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(${payments.paidAt}, '%Y-%m')`);

    // Pelanggan baru per bulan
    const newByMonth = await this.db
      .select({
        month: sql<string>`DATE_FORMAT(${customers.createdAt}, '%Y-%m')`,
        count: count(),
      })
      .from(customers)
      .where(and(
        eq(customers.tenantId, user.tenantId),
        sql`YEAR(${customers.createdAt}) = ${year}`,
      ))
      .groupBy(sql`DATE_FORMAT(${customers.createdAt}, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(${customers.createdAt}, '%Y-%m')`);

    // Isi 12 bulan
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      const key = `${year}-${m}`;
      const rev = revenueByMonth.find(r => r.month === key);
      const newC = newByMonth.find(r => r.month === key);
      return {
        month: key,
        label: new Date(`${year}-${m}-01`).toLocaleDateString('id-ID', { month: 'short' }),
        revenue: Number(rev?.total ?? 0),
        paymentCount: Number(rev?.count ?? 0),
        newCustomers: Number(newC?.count ?? 0),
      };
    });

    return {
      year,
      months,
      summary: {
        totalRevenue: months.reduce((s, m) => s + m.revenue, 0),
        totalPayments: months.reduce((s, m) => s + m.paymentCount, 0),
        totalNewCustomers: months.reduce((s, m) => s + m.newCustomers, 0),
      },
    };
  }

  // ─── Helper ───────────────────────────────────────────────────────────

  private normalizePeriod(query: ReportPeriodDto): {
    startDate: string;
    endDate: string;
  } {
    const today = new Date();
    const endDate =
      query.endDate ?? today.toISOString().split('T')[0];
    const startDate =
      query.startDate ??
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    return { startDate, endDate };
  }
}