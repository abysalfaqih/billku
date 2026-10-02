import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

const imageUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (err: Error | null, accept: boolean) => void,
  ) => {
    if (!file.mimetype.match(/^image\/(jpg|jpeg|png|webp|svg\+xml)$/)) {
      return cb(
        new BadRequestException(
          'Hanya file gambar (jpg, png, webp, svg) yang diizinkan',
        ),
        false,
      );
    }
    cb(null, true);
  },
};

@Controller('tenants')
export class TenantsController {
  constructor(private service: TenantsService) {}

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateTenantDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('super_admin')
  findAll() {
    return this.service.findAll();
  }

  // me/profile = profil tenant SENDIRI (bukan kelola tenant lain), jadi
  // dibuka untuk semua role termasuk staff — beda dengan endpoint lain di
  // controller ini yang mengelola SELURUH tenant (tetap super_admin only).
  @Get('me/profile')
  getMyProfile(@CurrentUser() user: AuthUser) {
    return this.service.findOne(user.tenantId);
  }

  @Put('me/profile')
  updateMyProfile(
    @Body() dto: UpdateTenantProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateProfile(user.tenantId, dto);
  }

  @Post('me/profile/logo')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.uploadLogo(user.tenantId, file);
  }

  @Post('me/profile/favicon')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  uploadFavicon(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.uploadFavicon(user.tenantId, file);
  }

  @Get(':id')
  @Roles('super_admin')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.service.update(id, dto);
  }

  @Put(':id/toggle-active')
  @Roles('super_admin')
  toggleActive(@Param('id') id: string) {
    return this.service.toggleActive(id);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
