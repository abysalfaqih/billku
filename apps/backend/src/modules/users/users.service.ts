import {
  Injectable, Inject, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { users, tenants } from '../../database/schema';
import { SubscriptionService } from '../subscription/subscription.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private subscriptionService: SubscriptionService,
  ) {}

  private resolveTenantId(currentUser: AuthUser, tenantIdQuery?: string): string {
    if (currentUser.role === 'super_admin' && tenantIdQuery) return tenantIdQuery;
    return currentUser.tenantId;
  }

  async create(dto: CreateUserDto, currentUser: AuthUser) {
    const targetTenantId = currentUser.role === 'super_admin' && dto.tenantId
      ? dto.tenantId
      : currentUser.tenantId;

    if (currentUser.role === 'super_admin' && dto.tenantId) {
      const [tenant] = await this.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, dto.tenantId))
        .limit(1);
      if (!tenant) throw new NotFoundException('Tenant tidak ditemukan');
    }

    // Limit hanya berlaku kalau admin tenant nambah staff-nya sendiri.
    // super_admin tidak dibatasi saat onboarding mitra baru.
    if (currentUser.role !== 'super_admin') {
      await this.subscriptionService.checkUserLimit(targetTenantId);
    }

    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, targetTenantId), eq(users.email, dto.email)))
      .limit(1);

    if (existing) {
      throw new ConflictException(`Email '${dto.email}' sudah digunakan di tenant ini`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const [result] = await this.db.insert(users).values({
      tenantId: targetTenantId,
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: dto.role,
    });

    const [created] = await this.db
      .select({
        id: users.id, name: users.name, email: users.email, role: users.role,
        isActive: users.isActive, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, Number(result.insertId)))
      .limit(1);

    return created;
  }

  async findAll(currentUser: AuthUser, tenantIdQuery?: string) {
    const tenantId = this.resolveTenantId(currentUser, tenantIdQuery);

    return this.db
      .select({
        id: users.id, name: users.name, email: users.email, role: users.role,
        isActive: users.isActive, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(users.name);
  }

  async findOne(id: number, currentUser: AuthUser, tenantIdQuery?: string) {
    const tenantId = this.resolveTenantId(currentUser, tenantIdQuery);

    const [user] = await this.db
      .select({
        id: users.id, name: users.name, email: users.email, role: users.role,
        isActive: users.isActive, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!user) throw new NotFoundException('Pengguna tidak ditemukan');
    return user;
  }

  async update(id: number, dto: UpdateUserDto, currentUser: AuthUser, tenantIdQuery?: string) {
    const tenantId = this.resolveTenantId(currentUser, tenantIdQuery);
    await this.findOne(id, currentUser, tenantIdQuery);

    if (dto.email) {
      const [existing] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.email, dto.email)))
        .limit(1);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Email '${dto.email}' sudah digunakan`);
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name) updateData.name = dto.name;
    if (dto.email) updateData.email = dto.email;
    if (dto.role) updateData.role = dto.role;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.password) updateData.password = await bcrypt.hash(dto.password, 12);

    await this.db
      .update(users)
      .set(updateData)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)));

    return this.findOne(id, currentUser, tenantIdQuery);
  }

  async toggleActive(id: number, currentUser: AuthUser, tenantIdQuery?: string) {
    const user = await this.findOne(id, currentUser, tenantIdQuery);

    if (user.id === currentUser.userId) {
      throw new BadRequestException('Tidak bisa menonaktifkan akun sendiri');
    }

    const tenantId = this.resolveTenantId(currentUser, tenantIdQuery);

    await this.db
      .update(users)
      .set({ isActive: !user.isActive, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)));

    return this.findOne(id, currentUser, tenantIdQuery);
  }
}