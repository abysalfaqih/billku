import {
  Injectable, Inject, NotFoundException, ConflictException,
} from '@nestjs/common';
import { eq, and, count } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { packages, customers, ipPools } from '../../database/schema';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { CreatePackageDto } from './dto/create-package.dto';
import type { UpdatePackageDto } from './dto/update-package.dto';

@Injectable()
export class PackagesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  async create(dto: CreatePackageDto, user: AuthUser) {
    if (dto.ipPoolId) {
      await this.validateIpPool(dto.ipPoolId, user.tenantId);
    }

    const [result] = await this.db.insert(packages).values({
      tenantId: user.tenantId,
      name: dto.name,
      description: dto.description,
      speedDownload: dto.speedDownload,
      speedUpload: dto.speedUpload,
      price: String(dto.price),
      ipPoolId: dto.ipPoolId,
    });

    return this.findOne(Number(result.insertId), user);
  }

  async findAll(user: AuthUser) {
    return this.db
      .select()
      .from(packages)
      .where(and(eq(packages.tenantId, user.tenantId), eq(packages.isActive, true)))
      .orderBy(packages.price);
  }

  async findOne(id: number, user: AuthUser) {
    const [pkg] = await this.db
      .select()
      .from(packages)
      .where(and(eq(packages.id, id), eq(packages.tenantId, user.tenantId)))
      .limit(1);

    if (!pkg) throw new NotFoundException(`Paket #${id} tidak ditemukan`);
    return pkg;
  }

  async update(id: number, dto: UpdatePackageDto, user: AuthUser) {
    await this.findOne(id, user);

    if (dto.ipPoolId) {
      await this.validateIpPool(dto.ipPoolId, user.tenantId);
    }

    const updateData: Record<string, unknown> = { ...dto, updatedAt: new Date() };
    if (dto.price !== undefined) updateData.price = String(dto.price);

    await this.db
      .update(packages)
      .set(updateData)
      .where(and(eq(packages.id, id), eq(packages.tenantId, user.tenantId)));

    return this.findOne(id, user);
  }

  async remove(id: number, user: AuthUser) {
    await this.findOne(id, user);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(customers)
      .where(and(eq(customers.packageId, id), eq(customers.tenantId, user.tenantId)));

    if (total > 0) {
      throw new ConflictException(
        `Paket masih digunakan oleh ${total} pelanggan. Pindahkan pelanggan ke paket lain terlebih dahulu.`,
      );
    }

    await this.db
      .update(packages)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(packages.id, id), eq(packages.tenantId, user.tenantId)));

    return { message: 'Paket berhasil dinonaktifkan' };
  }

  private async validateIpPool(ipPoolId: number, tenantId: string) {
    const [pool] = await this.db
      .select({ id: ipPools.id })
      .from(ipPools)
      .where(and(eq(ipPools.id, ipPoolId), eq(ipPools.tenantId, tenantId)))
      .limit(1);

    if (!pool) throw new NotFoundException('IP Pool tidak ditemukan');
  }
}