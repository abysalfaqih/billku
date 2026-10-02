import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
@Roles('super_admin', 'admin')
export class UsersController {
  constructor(private service: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  findAll(@Query('tenantId') tenantId: string, @CurrentUser() user: AuthUser) {
    return this.service.findAll(user, tenantId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('tenantId') tenantId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findOne(id, user, tenantId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Query('tenantId') tenantId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user, tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('tenantId') tenantId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.remove(id, user, tenantId);
  }

  @Put(':id/toggle-active')
  @HttpCode(HttpStatus.OK)
  toggleActive(
    @Param('id', ParseIntPipe) id: number,
    @Query('tenantId') tenantId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.toggleActive(id, user, tenantId);
  }
}