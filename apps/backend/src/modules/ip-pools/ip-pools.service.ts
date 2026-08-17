import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { ipPools, mikrotikConfigs } from '../../database/schema';
import { MikrotikService } from '../mikrotik/mikrotik.service';
import { RadiusService } from '../radius/radius.service';
import { parseCidr, isValidCidr } from '../../common/utils/cidr.util';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { CreateIpPoolDto } from './dto/create-ip-pool.dto';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class IpPoolsService {
  private readonly logger = new Logger(IpPoolsService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private subscriptionService: SubscriptionService,
    private mikrotikService: MikrotikService,
    private radiusService: RadiusService,
  ) {}

  async create(dto: CreateIpPoolDto, user: AuthUser) {

    if (user.role !== 'super_admin') {
      await this.subscriptionService.checkIpPoolLimit(user.tenantId);
    }

    if (!isValidCidr(dto.network)) {
      throw new BadRequestException('Format CIDR tidak valid');
    }

    const { gateway, ipStart, ipEnd } = parseCidr(dto.network);

    const [mikrotikConfig] = await this.db
      .select()
      .from(mikrotikConfigs)
      .where(
        and(
          eq(mikrotikConfigs.id, dto.mikrotikConfigId),
          eq(mikrotikConfigs.tenantId, user.tenantId),
          eq(mikrotikConfigs.isActive, true),
        ),
      )
      .limit(1);

    if (!mikrotikConfig) {
      throw new NotFoundException('Konfigurasi Mikrotik tidak ditemukan');
    }

    const dnsPrimary = dto.dnsPrimary ?? '8.8.8.8';
    const dnsSecondary = dto.dnsSecondary ?? '8.8.4.4';

    const [result] = await this.db.insert(ipPools).values({
      tenantId: user.tenantId,
      mikrotikConfigId: dto.mikrotikConfigId,
      displayName: dto.displayName,
      name: dto.name,
      network: dto.network,
      gateway, ipStart, ipEnd, dnsPrimary, dnsSecondary,
    });

    const pool = await this.findOne(Number(result.insertId), user);

    try {
      await this.mikrotikService.createIpPool(mikrotikConfig, dto.name, ipStart, ipEnd);
      await this.mikrotikService.createPppoeProfile(mikrotikConfig, dto.name, gateway, dto.name, dnsPrimary, dnsSecondary);
    } catch (err) {
      this.logger.warn(`Gagal sync IP Pool '${dto.name}' ke Mikrotik: ${err}`);
    }

    await this.radiusService.createGroup(dto.name);

    return pool;
  }

  async findAll(user: AuthUser) {
    return this.db
      .select()
      .from(ipPools)
      .where(and(eq(ipPools.tenantId, user.tenantId), eq(ipPools.isActive, true)))
      .orderBy(ipPools.displayName);
  }

  async findOne(id: number, user: AuthUser) {
    const [pool] = await this.db
      .select()
      .from(ipPools)
      .where(and(eq(ipPools.id, id), eq(ipPools.tenantId, user.tenantId)))
      .limit(1);

    if (!pool) throw new NotFoundException('IP Pool tidak ditemukan');
    return pool;
  }

  async remove(id: number, user: AuthUser) {
    const pool = await this.findOne(id, user);

    const [mikrotikConfig] = await this.db
      .select()
      .from(mikrotikConfigs)
      .where(eq(mikrotikConfigs.id, pool.mikrotikConfigId))
      .limit(1);

    if (mikrotikConfig) {
      try {
        await this.mikrotikService.deletePppoeProfile(mikrotikConfig, pool.name);
        await this.mikrotikService.deleteIpPool(mikrotikConfig, pool.name);
      } catch (err) {
        // Mikrotik gagal dibersihkan (offline / reply tidak dikenali) —
        // tetap lanjut hapus dari sistem kita, jangan sampai nyangkut.
        this.logger.warn(`Gagal hapus Profile/Pool '${pool.name}' di Mikrotik: ${err}`);
      }
    }

    await this.radiusService.deleteGroup(pool.name);

    await this.db
      .update(ipPools)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(ipPools.id, id));

    return { message: 'IP Pool berhasil dihapus' };
  }
}