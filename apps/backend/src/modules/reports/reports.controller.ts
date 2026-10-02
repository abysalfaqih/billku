import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportPeriodDto } from './dto/report-period.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { SubscriptionService } from '../subscription/subscription.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private reportsService: ReportsService,
    private subscriptionService: SubscriptionService,
  ) {}

  // Dashboard — summary semua data dalam 1 call
  @Get('dashboard')
  async dashboard(@CurrentUser() user: AuthUser) {
    if (user.role !== 'super_admin') {
      await this.subscriptionService.checkReportsFeature(user.tenantId);
    }
    return this.reportsService.getDashboard(user);
  }

  // Laporan pendapatan dengan filter periode
  @Get('revenue')
  async revenue(
    @Query() query: ReportPeriodDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role !== 'super_admin') {
      await this.subscriptionService.checkReportsFeature(user.tenantId);
    }
    return this.reportsService.getRevenue(query, user);
  }

  @Get('monthly')
  async getMonthlyReport(
    @Query('year') year: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role !== 'super_admin') {
      await this.subscriptionService.checkReportsFeature(user.tenantId);
    }

    const y = year ? parseInt(year) : new Date().getFullYear();
    return this.reportsService.getMonthlyReport(y, user);
  }

  // Statistik tagihan
  @Get('bills')
  async bills(@CurrentUser() user: AuthUser) {
    if (user.role !== 'super_admin') {
      await this.subscriptionService.checkReportsFeature(user.tenantId);
    }

    return this.reportsService.getBillsSummary(user);
  }

  // Statistik pelanggan
  @Get('customers')
  async customers(@CurrentUser() user: AuthUser) {
    if (user.role !== 'super_admin') {
      await this.subscriptionService.checkReportsFeature(user.tenantId);
    }

    return this.reportsService.getCustomersSummary(user);
  }
}