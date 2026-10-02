import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, count } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { mikrotikConfigs, ipPools } from '../../database/schema';
import { MikrotikService } from '../mikrotik/mikrotik.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { RadiusService } from '../radius/radius.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { CreateMikrotikConfigDto } from './dto/create-mikrotik-config.dto';
import type { UpdateMikrotikConfigDto } from './dto/update-mikrotik-config.dto';

@Injectable()
export class MikrotikConfigsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private mikrotikService: MikrotikService,
    private radiusService: RadiusService,
    private subscriptionService: SubscriptionService,
  ) {}

  async create(dto: CreateMikrotikConfigDto, user: AuthUser) {
    // Cek limit (super_admin bypass)
    if (user.role !== 'super_admin') {
      await this.subscriptionService.checkMikrotikLimit(user.tenantId);
    }

    const [result] = await this.db.insert(mikrotikConfigs).values({
      tenantId: user.tenantId,
      name: dto.name,
      host: dto.host,
      port: dto.port,
      username: dto.username,
      password: dto.password,
      radiusSecret: dto.radiusSecret,
    });

    const config = await this.findOne(Number(result.insertId), user);
    await this.radiusService.registerNas(config.host, config.name, config.radiusSecret);
    return config;
  }

  // Dipanggil siapa saja yang login (termasuk staff, buat dropdown). Makanya
  // cuma field aman yang dikirim — password/username/radiusSecret TIDAK ikut.
  // Detail lengkap cuma lewat findOne(), yang sudah dikunci admin-only.
  async findAll(user: AuthUser) {
    return this.db
      .select({
        id: mikrotikConfigs.id,
        name: mikrotikConfigs.name,
        host: mikrotikConfigs.host,
      })
      .from(mikrotikConfigs)
      .where(and(eq(mikrotikConfigs.tenantId, user.tenantId), eq(mikrotikConfigs.isActive, true)));
  }

  async findOne(id: number, user: AuthUser) {
    const [config] = await this.db
      .select()
      .from(mikrotikConfigs)
      .where(and(eq(mikrotikConfigs.id, id), eq(mikrotikConfigs.tenantId, user.tenantId)))
      .limit(1);
    if (!config) throw new NotFoundException('Konfigurasi Mikrotik tidak ditemukan');
    return config;
  }

  async update(id: number, dto: UpdateMikrotikConfigDto, user: AuthUser) {
    const existing = await this.findOne(id, user);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.host !== undefined) updateData.host = dto.host;
    if (dto.port !== undefined) updateData.port = dto.port;
    if (dto.username !== undefined) updateData.username = dto.username;
    if (dto.password) updateData.password = dto.password; // kosong = password tidak diubah
    if (dto.radiusSecret) updateData.radiusSecret = dto.radiusSecret; // kosong = secret tidak diubah

    await this.db
      .update(mikrotikConfigs)
      .set(updateData)
      .where(and(eq(mikrotikConfigs.id, id), eq(mikrotikConfigs.tenantId, user.tenantId)));

    const updated = await this.findOne(id, user);

    // Sinkronkan NAS di FreeRADIUS kalau host/nama/secret berubah.
    // registerNas mencari NAS berdasarkan nasname (= host lama), jadi kalau
    // host-nya diganti, entri NAS lama harus dihapus dulu (kalau tidak, akan
    // tersisa NAS "hantu" dengan host lama yang salah) baru daftarkan ulang
    // dengan host yang baru.
    const hostChanged = dto.host !== undefined && dto.host !== existing.host;
    const nasFieldsChanged =
      hostChanged ||
      updated.name !== existing.name ||
      updated.radiusSecret !== existing.radiusSecret;

    if (nasFieldsChanged) {
      if (hostChanged) {
        await this.radiusService.removeNas(existing.host);
      }
      await this.radiusService.registerNas(updated.host, updated.name, updated.radiusSecret);
    }

    return updated;
  }

  async testConnection(id: number, user: AuthUser) {
    const config = await this.findOne(id, user);
    const result = await this.mikrotikService.testConnection(config);
    return {
      connected: result.connected,
      identity: result.identity,
      message: result.connected
        ? `Terhubung ke "${result.identity ?? 'Mikrotik'}" (${config.host})`
        : `Gagal terhubung ke Mikrotik ${config.host}`,
    };
  }

  async getHotspotProfiles(id: number, user: AuthUser): Promise<string[]> {
    const config = await this.findOne(id, user);
    try {
      return await this.mikrotikService.getHotspotProfiles(config);
    } catch (err) {
      throw new NotFoundException(
        `Gagal ambil hotspot profile: ${err.message}. Pastikan Mikrotik punya fitur Hotspot aktif.`
      );
    }
  }

  async remove(id: number, user: AuthUser) {
    const config = await this.findOne(id, user);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(ipPools)
      .where(and(eq(ipPools.mikrotikConfigId, id), eq(ipPools.isActive, true)));

    if (total > 0) {
      throw new ConflictException(
        `Mikrotik masih dipakai oleh ${total} IP Pool. Hapus IP Pool terlebih dahulu.`
      );
    }

    await this.radiusService.removeNas(config.host);

    await this.db
      .update(mikrotikConfigs)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(mikrotikConfigs.id, id), eq(mikrotikConfigs.tenantId, user.tenantId)));

    return { message: 'Konfigurasi Mikrotik berhasil dinonaktifkan' };
  }
}