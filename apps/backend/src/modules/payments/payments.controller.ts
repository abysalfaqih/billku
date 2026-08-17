import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // Staff juga bisa tandai lunas — tidak hanya admin
  @Post()
  @Roles('super_admin', 'admin', 'staff')
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: QueryPaymentDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.findAll(query, user);
  }

  // ⬇️ DIPINDAHKAN KE SINI (sebelum @Get(':id')) — isi method TIDAK diubah
  @Get('export')
  async exportCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const csv = await this.paymentsService.exportCsv(user);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pembayaran-${new Date().toISOString().split('T')[0]}.csv"`,
    });
    res.send('\uFEFF' + csv);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.findOne(id, user);
  }
}