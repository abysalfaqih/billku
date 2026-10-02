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
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('packages')
export class PackagesController {
  constructor(private packagesService: PackagesService) {}

  @Post()
  @Roles('super_admin', 'admin')
  create(@Body() dto: CreatePackageDto, @CurrentUser() user: AuthUser) {
    return this.packagesService.create(dto, user);
  }

  // Sengaja TIDAK di-@Roles(): dipakai staff untuk dropdown pilih paket
  // saat bikin/edit pelanggan.
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.packagesService.findAll(user);
  }

  @Get(':id')
  @Roles('super_admin', 'admin')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.packagesService.findOne(id, user);
  }

  @Put(':id')
  @Roles('super_admin', 'admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePackageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.packagesService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.packagesService.remove(id, user);
  }
}