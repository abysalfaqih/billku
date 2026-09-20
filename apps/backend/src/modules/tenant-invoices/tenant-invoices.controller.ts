import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { TenantInvoicesService } from './tenant-invoices.service';
import { CreateTenantInvoiceDto } from './dto/create-tenant-invoice.dto';
import { UpdateTenantInvoiceDto } from './dto/update-tenant-invoice.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantsService } from '../tenants/tenants.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('tenant-invoices')
@Roles('super_admin')
export class TenantInvoicesController {
  constructor(
    private service: TenantInvoicesService,
    private tenantsService: TenantsService,
  ) {}

  @Post()
  create(@Body() dto: CreateTenantInvoiceDto) {
    return this.service.create(dto);
  }

  @Post(':tenantId/auto-bandwidth')
  @HttpCode(HttpStatus.OK)
  autoFromBandwidth(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      periodMonth: number;
      periodYear: number;
      ppnPercent?: number;
      paymentDescription?: string;
      authorizedBy?: string;
      authorizedTitle?: string;
    },
  ) {
    return this.service.generateAutoFromBandwidth(
      tenantId,
      body.periodMonth,
      body.periodYear,
      body,
    );
  }

  @Get()
  findAll(@Query('tenantId') tenantId?: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTenantInvoiceDto,
  ) {
    return this.service.update(id, dto);
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'draft' | 'sent' | 'paid' },
  ) {
    return this.service.updateStatus(id, body.status);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const issuer = await this.tenantsService.findOne(user.tenantId);
    const buffer = await this.service.generatePdf(id, {
      name: issuer.name,
      address: issuer.address,
      phone: issuer.phone,
      email: issuer.email,
      logoUrl: issuer.logoUrl,
    });

    const inv = await this.service.findOne(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${inv.invoiceNumber}.pdf"`,
    });
    res.send(buffer);
  }
}
