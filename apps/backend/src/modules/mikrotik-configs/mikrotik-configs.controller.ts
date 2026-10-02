import {
  Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { MikrotikConfigsService } from './mikrotik-configs.service';
import { CreateMikrotikConfigDto } from './dto/create-mikrotik-config.dto';
import { UpdateMikrotikConfigDto } from './dto/update-mikrotik-config.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('mikrotik-configs')
export class MikrotikConfigsController {
  constructor(private service: MikrotikConfigsService) {}

  @Post()
  @Roles('super_admin', 'admin')
  create(@Body() dto: CreateMikrotikConfigDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  // Sengaja TIDAK di-@Roles(): dipakai staff untuk dropdown pilih Mikrotik
  // saat bikin pelanggan hotspot baru. Field sensitif (password, dsb) sudah
  // tidak disertakan di findAll() — lihat service.
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @Roles('super_admin', 'admin')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Put(':id')
  @Roles('super_admin', 'admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMikrotikConfigDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/test')
  @Roles('super_admin', 'admin')
  @HttpCode(HttpStatus.OK)
  testConnection(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.testConnection(id, user);
  }

  // Sengaja TIDAK di-@Roles(): dipakai staff untuk pilih hotspot profile
  // saat bikin pelanggan hotspot baru. Cuma balikin nama profile (string[]),
  // tidak ada data sensitif.
  @Get(':id/hotspot-profiles')
  getHotspotProfiles(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.getHotspotProfiles(id, user);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}