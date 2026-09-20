import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantSubscriptionsService } from './tenant-subscriptions.service';
import { CreateTenantSubscriptionDto } from './dto/create-tenant-subscription.dto';
import { UpdateTenantSubscriptionDto } from './dto/update-tenant-subscription.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('tenant-subscriptions')
export class TenantSubscriptionsController {
  constructor(private service: TenantSubscriptionsService) {}

  // Super admin aktifkan langganan mitra (juga dipakai untuk "ganti paket" —
  // request baru otomatis membatalkan langganan aktif sebelumnya)
  @Post()
  @Roles('super_admin')
  create(
    @Body() dto: CreateTenantSubscriptionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(dto, user);
  }

  // Super admin lihat semua tenant + status langganan
  @Get()
  @Roles('super_admin')
  findAll() {
    return this.service.findAllTenants();
  }

  // Lihat riwayat langganan tenant tertentu
  @Get('tenant/:tenantId')
  @Roles('super_admin')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.service.findByTenant(tenantId);
  }

  // Tenant melihat langganan aktif mereka sendiri
  @Get('my-plan')
  myPlan(@CurrentUser() user: AuthUser) {
    return this.service.getActivePlan(user.tenantId);
  }

  // Koreksi record langganan yang sudah ada (paket/durasi/nominal/status/catatan)
  @Put(':id')
  @Roles('super_admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTenantSubscriptionDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.service.cancel(id);
  }
}
