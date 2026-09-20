import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, ne } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import {
  tenants,
  users,
  customers,
  bills,
  payments,
  packages,
  ipPools,
  mikrotikConfigs,
  whatsappConfigs,
  whatsappTemplates,
  whatsappLogs,
  areas,
  activityLogs,
  refreshTokens,
  tenantInvoices,
  tenantSubscriptions,
} from '../../database/schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';
import type { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private cloudinary: CloudinaryService,
  ) {}

  async create(dto: CreateTenantDto) {
    const [existing] = await this.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, dto.slug))
      .limit(1);
    if (existing)
      throw new ConflictException(`Slug '${dto.slug}' sudah digunakan`);

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

    const [created] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, dto.slug))
      .limit(1);
    return created;
  }

  async findAll() {
    return this.db.select().from(tenants).orderBy(tenants.name);
  }

  async findOne(id: string) {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
    if (!tenant) throw new NotFoundException('Tenant tidak ditemukan');
    return tenant;
  }

  async toggleActive(id: string) {
    const tenant = await this.findOne(id);
    await this.db
      .update(tenants)
      .set({ isActive: !tenant.isActive, updatedAt: new Date() })
      .where(eq(tenants.id, id));
    return this.findOne(id);
  }

  // Dipakai super_admin untuk mengedit data mitra manapun dari halaman Mitra
  // (beda dari updateProfile() di bawah, yang dipakai tenant untuk edit profilnya sendiri).
  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id); // 404 kalau tenant tidak ada

    if (dto.slug) {
      const [existing] = await this.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(and(eq(tenants.slug, dto.slug), ne(tenants.id, id)))
        .limit(1);
      if (existing)
        throw new ConflictException(
          `Slug '${dto.slug}' sudah digunakan mitra lain`,
        );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.motto !== undefined) updateData.motto = dto.motto;
    if (dto.about !== undefined) updateData.about = dto.about;
    if (dto.bandwidthEnabled !== undefined)
      updateData.bandwidthEnabled = dto.bandwidthEnabled;
    if (dto.bandwidthDescription !== undefined)
      updateData.bandwidthDescription = dto.bandwidthDescription;
    if (dto.bandwidthPriceMonthly !== undefined)
      updateData.bandwidthPriceMonthly = dto.bandwidthPriceMonthly;
    if (dto.bankAccounts)
      updateData.bankAccounts = JSON.stringify(dto.bankAccounts);

    await this.db.update(tenants).set(updateData).where(eq(tenants.id, id));
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
    if (dto.bandwidthEnabled !== undefined)
      updateData.bandwidthEnabled = dto.bandwidthEnabled;
    if (dto.bandwidthDescription !== undefined)
      updateData.bandwidthDescription = dto.bandwidthDescription;
    if (dto.bandwidthPriceMonthly !== undefined)
      updateData.bandwidthPriceMonthly = dto.bandwidthPriceMonthly;
    if (dto.bankAccounts)
      updateData.bankAccounts = JSON.stringify(dto.bankAccounts);

    await this.db
      .update(tenants)
      .set(updateData)
      .where(eq(tenants.id, tenantId));
    return this.findOne(tenantId);
  }

  async uploadLogo(tenantId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File logo tidak ditemukan');
    const url = await this.cloudinary.uploadImage(file.buffer, 'billku/logos');
    await this.db
      .update(tenants)
      .set({ logoUrl: url, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));
    return this.findOne(tenantId);
  }

  async uploadFavicon(tenantId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File favicon tidak ditemukan');
    const url = await this.cloudinary.uploadImage(
      file.buffer,
      'billku/favicons',
    );
    await this.db
      .update(tenants)
      .set({ faviconUrl: url, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));
    return this.findOne(tenantId);
  }

  // ─── Remove (hapus mitra + seluruh data turunannya) ────────────────────────
  //
  // Ini operasi destruktif & permanen: menghapus mitra sekaligus SELURUH data
  // yang menempel padanya (pengguna/staff, pelanggan, tagihan & pembayaran
  // pelanggan, paket, IP pool, konfigurasi Mikrotik & WhatsApp, area, log
  // aktivitas, refresh token, invoice mitra, dan riwayat langganan mitra).
  //
  // Dijalankan dalam SATU transaksi (semua-atau-tidak-sama-sekali) supaya kalau
  // ada kegagalan di tengah jalan, data tidak nyangkut setengah terhapus.
  // Urutan hapus WAJIB mengikuti arah foreign key (anak sebelum induk), kalau
  // dibalik akan kena error constraint dari MySQL:
  //
  //   whatsapp_logs → payments → bills → refresh_tokens → tenant_subscriptions
  //   → customers → packages → ip_pools → mikrotik_configs → whatsapp_configs
  //   → whatsapp_templates → areas → activity_logs → users → tenant_invoices
  //   → tenants
  //
  // CATATAN: yang dibersihkan adalah data di database aplikasi. Perangkat fisik
  // milik mitra (router Mikrotik) dan akun pihak ketiga (API WhatsApp) TIDAK
  // ikut dihapus dari luar sistem — itu properti/akun mitra sendiri di luar
  // kendali database ini, dan mencoba menghapusnya dari jarak jauh saat mitra
  // dihapus berisiko mengganggu perangkat yang mungkin masih dipakai.
  async remove(id: string) {
    const tenant = await this.findOne(id); // 404 kalau tenant tidak ada

    // Proteksi: jangan sampai tenant "rumah" milik akun super_admin (pemilik
    // platform) ikut terhapus — itu akan langsung mengunci akses admin sendiri
    // dari sistem. Mitra biasa hanya berisi user berperan admin/staff.
    const [superAdminUser] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, id), eq(users.role, 'super_admin')))
      .limit(1);

    if (superAdminUser) {
      throw new BadRequestException(
        'Tenant ini berisi akun Super Admin (akun pemilik platform) sehingga tidak boleh dihapus. ' +
          'Ini biasanya adalah tenant utama sistem, bukan mitra biasa.',
      );
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(whatsappLogs).where(eq(whatsappLogs.tenantId, id));
      await tx.delete(payments).where(eq(payments.tenantId, id));
      await tx.delete(bills).where(eq(bills.tenantId, id));
      await tx.delete(refreshTokens).where(eq(refreshTokens.tenantId, id));
      await tx
        .delete(tenantSubscriptions)
        .where(eq(tenantSubscriptions.tenantId, id));
      await tx.delete(customers).where(eq(customers.tenantId, id));
      await tx.delete(packages).where(eq(packages.tenantId, id));
      await tx.delete(ipPools).where(eq(ipPools.tenantId, id));
      await tx.delete(mikrotikConfigs).where(eq(mikrotikConfigs.tenantId, id));
      await tx.delete(whatsappConfigs).where(eq(whatsappConfigs.tenantId, id));
      await tx
        .delete(whatsappTemplates)
        .where(eq(whatsappTemplates.tenantId, id));
      await tx.delete(areas).where(eq(areas.tenantId, id));
      await tx.delete(activityLogs).where(eq(activityLogs.tenantId, id));
      await tx.delete(users).where(eq(users.tenantId, id));
      await tx.delete(tenantInvoices).where(eq(tenantInvoices.tenantId, id));
      await tx.delete(tenants).where(eq(tenants.id, id));
    });

    return {
      message:
        `Mitra '${tenant.name}' beserta seluruh data terkait (pengguna, pelanggan, tagihan, ` +
        'invoice, dan langganan) berhasil dihapus permanen',
    };
  }
}
