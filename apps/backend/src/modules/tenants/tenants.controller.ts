import {
  Controller, Get, Post, Put, Body, Param, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

const imageUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, accept: boolean) => void) => {
    if (!file.mimetype.match(/^image\/(jpg|jpeg|png|webp|svg\+xml)$/)) {
      return cb(new BadRequestException('Hanya file gambar (jpg, png, webp, svg) yang diizinkan'), false);
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

  @Get('me/profile')
  @Roles('super_admin', 'admin')
  getMyProfile(@CurrentUser() user: AuthUser) {
    return this.service.findOne(user.tenantId);
  }

  @Put('me/profile')
  @Roles('super_admin', 'admin')
  updateMyProfile(@Body() dto: UpdateTenantProfileDto, @CurrentUser() user: AuthUser) {
    return this.service.updateProfile(user.tenantId, dto);
  }

  @Post('me/profile/logo')
  @Roles('super_admin', 'admin')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  uploadLogo(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    return this.service.uploadLogo(user.tenantId, file);
  }

  @Post('me/profile/favicon')
  @Roles('super_admin', 'admin')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  uploadFavicon(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    return this.service.uploadFavicon(user.tenantId, file);
  }

  @Get(':id')
  @Roles('super_admin')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id/toggle-active')
  @Roles('super_admin')
  toggleActive(@Param('id') id: string) {
    return this.service.toggleActive(id);
  }
}