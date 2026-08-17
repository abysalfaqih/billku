import {
  Injectable, Inject, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { tenants } from '../../database/schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';

@Injectable()
export class TenantsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private cloudinary: CloudinaryService,
  ) {}

  async create(dto: CreateTenantDto) {
    const [existing] = await this.db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, dto.slug)).limit(1);
    if (existing) throw new ConflictException(`Slug '${dto.slug}' sudah digunakan`);

    await this.db.insert(tenants).values({
      name: dto.name,
      slug: dto.slug,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      bandwidthEnabled: dto.bandwidthEnabled,
      bandwidthDescription: dto.bandwidthDescription,
      bandwidthPriceMonthly: dto.bandwidthPriceMonthly,
    });

    const [created] = await this.db.select().from(tenants).where(eq(tenants.slug, dto.slug)).limit(1);
    return created;
  }

  async findAll() {
    return this.db.select().from(tenants).orderBy(tenants.name);
  }

  async findOne(id: string) {
    const [tenant] = await this.db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    if (!tenant) throw new NotFoundException('Tenant tidak ditemukan');
    return tenant;
  }

  async toggleActive(id: string) {
    const tenant = await this.findOne(id);
    await this.db.update(tenants).set({ isActive: !tenant.isActive, updatedAt: new Date() }).where(eq(tenants.id, id));
    return this.findOne(id);
  }

  async updateProfile(tenantId: string, dto: UpdateTenantProfileDto) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name) updateData.name = dto.name;
    if (dto.email) updateData.email = dto.email;
    if (dto.phone) updateData.phone = dto.phone;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.motto !== undefined) updateData.motto = dto.motto;
    if (dto.about !== undefined) updateData.about = dto.about;
    if (dto.bandwidthEnabled !== undefined) updateData.bandwidthEnabled = dto.bandwidthEnabled;
    if (dto.bandwidthDescription !== undefined) updateData.bandwidthDescription = dto.bandwidthDescription;
    if (dto.bandwidthPriceMonthly !== undefined) updateData.bandwidthPriceMonthly = dto.bandwidthPriceMonthly;
    if (dto.bankAccounts) updateData.bankAccounts = JSON.stringify(dto.bankAccounts);

    await this.db.update(tenants).set(updateData).where(eq(tenants.id, tenantId));
    return this.findOne(tenantId);
  }

  async uploadLogo(tenantId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File logo tidak ditemukan');
    const url = await this.cloudinary.uploadImage(file.buffer, 'billku/logos');
    await this.db.update(tenants).set({ logoUrl: url, updatedAt: new Date() }).where(eq(tenants.id, tenantId));
    return this.findOne(tenantId);
  }

  async uploadFavicon(tenantId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File favicon tidak ditemukan');
    const url = await this.cloudinary.uploadImage(file.buffer, 'billku/favicons');
    await this.db.update(tenants).set({ faviconUrl: url, updatedAt: new Date() }).where(eq(tenants.id, tenantId));
    return this.findOne(tenantId);
  }
}