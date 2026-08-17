import {
  Controller, Get, Post, Put, Param, Query, ParseIntPipe,
  HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BillingService } from './billing.service';
import { QueryBillingDto } from './dto/query-billing.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('generate/:customerId')
  @Roles('super_admin', 'admin')
  generate(@Param('customerId', ParseIntPipe) customerId: number, @CurrentUser() user: AuthUser) {
    return this.billingService.generateManual(customerId, user);
  }

  @Get()
  findAll(@Query() query: QueryBillingDto, @CurrentUser() user: AuthUser) {
    return this.billingService.findAll(query, user);
  }

  // ⬇️ DIPINDAHKAN KE SINI (sebelum @Get(':id')) — isi method TIDAK diubah
  @Get('export')
  async exportCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const csv = await this.billingService.exportCsv(user);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tagihan-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    res.send('\uFEFF' + csv);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.billingService.findOne(id, user);
  }

  @Get(':id/invoice')
  async downloadInvoice(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const buffer = await this.billingService.generateInvoicePdf(id, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
    });
    res.send(buffer);
  }

  @Put(':id/cancel')
  @Roles('super_admin', 'admin')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.billingService.cancel(id, user);
  }
}