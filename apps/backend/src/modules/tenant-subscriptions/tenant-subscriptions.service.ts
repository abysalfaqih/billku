import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, count, desc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { tenantSubscriptions, subscriptionPlans, tenants } from '../../database/schema';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { CreateTenantSubscriptionDto } from './dto/create-tenant-subscription.dto';

@Injectable()
export class TenantSubscriptionsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  async create(dto: CreateTenantSubscriptionDto, user: AuthUser) {
    // Validasi tenant ada
    const [tenant] = await this.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, dto.tenantId))
      .limit(1);

    if (!tenant) throw new NotFoundException('Tenant tidak ditemukan');

    // Validasi plan ada
    const [plan] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, dto.planId))
      .limit(1);

    if (!plan) throw new NotFoundException('Paket langganan tidak ditemukan');

    // Hitung tanggal expiry
    const startedAt = new Date();
    const expiresAt = new Date(startedAt);
    expiresAt.setMonth(expiresAt.getMonth() + dto.durationMonths);

    // Nonaktifkan langganan lama yang masih active/trial
    await this.db
      .update(tenantSubscriptions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(tenantSubscriptions.tenantId, dto.tenantId),
          eq(tenantSubscriptions.status, 'active'),
        ),
      );

    const [result] = await this.db.insert(tenantSubscriptions).values({
      tenantId: dto.tenantId,
      planId: dto.planId,
      status: dto.status,
      startedAt,
      expiresAt,
      durationMonths: dto.durationMonths,
      amountPaid: String(dto.amountPaid),
      notes: dto.notes,
      createdBy: user.userId,
    });

    return this.findOne(Number(result.insertId));
  }

  async findOne(id: number) {
    const [sub] = await this.db
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.id, id))
      .limit(1);

    if (!sub) throw new NotFoundException('Langganan tidak ditemukan');
    return sub;
  }

  async findByTenant(tenantId: string) {
    return this.db
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .orderBy(desc(tenantSubscriptions.createdAt));
  }

  async findAllTenants() {
    // Super admin melihat semua tenant + status langganannya
    return this.db
      .select({
        tenantId: tenants.id,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        subscriptionId: tenantSubscriptions.id,
        planId: tenantSubscriptions.planId,
        status: tenantSubscriptions.status,
        expiresAt: tenantSubscriptions.expiresAt,
        durationMonths: tenantSubscriptions.durationMonths,
        amountPaid: tenantSubscriptions.amountPaid,
      })
      .from(tenants)
      .leftJoin(
        tenantSubscriptions,
        and(
          eq(tenantSubscriptions.tenantId, tenants.id),
          eq(tenantSubscriptions.status, 'active'),
        ),
      )
      .orderBy(tenants.name);
  }

  // Ambil langganan aktif tenant
  async getActivePlan(tenantId: string) {
    const [active] = await this.db
      .select({
        subscription: tenantSubscriptions,
        plan: subscriptionPlans,
      })
      .from(tenantSubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(tenantSubscriptions.planId, subscriptionPlans.id),
      )
      .where(
        and(
          eq(tenantSubscriptions.tenantId, tenantId),
          eq(tenantSubscriptions.status, 'active'),
        ),
      )
      .limit(1);

    return active ?? null;
  }

  async cancel(id: number) {
    await this.findOne(id);

    await this.db
      .update(tenantSubscriptions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(tenantSubscriptions.id, id));

    return { message: 'Langganan dibatalkan' };
  }

  // Jalankan setiap hari via scheduler untuk expire langganan yang sudah habis
  async processExpiredSubscriptions() {
    await this.db
      .update(tenantSubscriptions)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(
        and(
          eq(tenantSubscriptions.status, 'active'),
          sql`${tenantSubscriptions.expiresAt} < NOW()`,
        ),
      );
  }
}