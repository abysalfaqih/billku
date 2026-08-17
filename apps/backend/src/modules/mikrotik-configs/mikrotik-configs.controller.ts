import {
  Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { MikrotikConfigsService } from './mikrotik-configs.service';
import { CreateMikrotikConfigDto } from './dto/create-mikrotik-config.dto';
import { UpdateMikrotikConfigDto } from './dto/update-mikrotik-config.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('mikrotik-configs')
export class MikrotikConfigsController {
  constructor(private service: MikrotikConfigsService) {}

  @Post()
  create(@Body() dto: CreateMikrotikConfigDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMikrotikConfigDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  testConnection(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.testConnection(id, user);
  }

  @Get(':id/hotspot-profiles')
  getHotspotProfiles(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.getHotspotProfiles(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}