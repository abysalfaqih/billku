import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, and, count } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { areas, customers } from '../../database/schema';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { CreateAreaDto } from './dto/create-area.dto';

@Injectable()
export class AreasService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  async create(dto: CreateAreaDto, user: AuthUser) {
    const [result] = await this.db.insert(areas).values({
      tenantId: user.tenantId,
      name: dto.name,
    });
    return this.findOne(Number(result.insertId), user);
  }

  async findAll(user: AuthUser) {
    return this.db
      .select()
      .from(areas)
      .where(and(eq(areas.tenantId, user.tenantId), eq(areas.isActive, true)))
      .orderBy(areas.name);
  }

  async findOne(id: number, user: AuthUser) {
    const [area] = await this.db
      .select()
      .from(areas)
      .where(and(eq(areas.id, id), eq(areas.tenantId, user.tenantId)))
      .limit(1);

    if (!area) throw new NotFoundException('Area tidak ditemukan');
    return area;
  }

  async remove(id: number, user: AuthUser) {
    await this.findOne(id, user);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(customers)
      .where(and(eq(customers.areaId, id), eq(customers.tenantId, user.tenantId)));

    if (total > 0) {
      throw new ConflictException(
        `Area masih dipakai oleh ${total} pelanggan. Pindahkan pelanggan ke area lain terlebih dahulu.`,
      );
    }

    await this.db
      .update(areas)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(areas.id, id), eq(areas.tenantId, user.tenantId)));

    return { message: 'Area berhasil dihapus' };
  }
}