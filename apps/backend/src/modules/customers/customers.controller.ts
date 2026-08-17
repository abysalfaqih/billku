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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Post()
  @Roles('super_admin', 'admin')
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customersService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: QueryCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customersService.findAll(query, user);
  }

  @Get('export')
  async exportCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const csv = await this.customersService.exportCsv(user);
    const filename = `pelanggan-${new Date().toISOString().split('T')[0]}.csv`;
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send('\uFEFF' + csv); // BOM agar Excel baca UTF-8 dengan benar
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.findOne(id, user);
  }

  @Get(':id/detail')
  findOneDetail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.findOneDetail(id, user);
  }

  @Put(':id')
  @Roles('super_admin', 'admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.remove(id, user);
  }

  @Post('sync-radius-all')
  @Roles('super_admin', 'admin')
  async syncRadiusAll(@CurrentUser() user: AuthUser) {
    return this.customersService.syncAllToRadius(user);
  }

  @Post(':id/reset-password')
  @Roles('super_admin', 'admin')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { newPassword: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.resetPassword(id, body.newPassword, user);
  }
}