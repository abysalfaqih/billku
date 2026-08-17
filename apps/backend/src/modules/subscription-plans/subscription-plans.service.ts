import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { subscriptionPlans } from '../../database/schema';
import type { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { PartialType } from '@nestjs/mapped-types';

@Injectable()
export class SubscriptionPlansService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  async create(dto: CreateSubscriptionPlanDto) {
    const [result] = await this.db.insert(subscriptionPlans).values({
      name: dto.name,
      description: dto.description,
      priceMonthly: String(dto.priceMonthly),
      maxCustomers: dto.maxCustomers,
      maxMikrotik: dto.maxMikrotik,
      maxIpPools: dto.maxIpPools,
      maxUsers: dto.maxUsers,
      hasWhatsapp: dto.hasWhatsapp ?? false,
      hasApiAccess: dto.hasApiAccess ?? false,
      hasReports: dto.hasReports ?? true,
      extraFeatures: dto.extraFeatures,
    });

    return this.findOne(Number(result.insertId));
  }

  async findAll() {
    return this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.priceMonthly);
  }

  async findOne(id: number) {
    const [plan] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, id))
      .limit(1);

    if (!plan) throw new NotFoundException('Paket langganan tidak ditemukan');
    return plan;
  }

  async update(id: number, dto: Partial<CreateSubscriptionPlanDto>) {
    await this.findOne(id);

    const updateData: Record<string, unknown> = {
      ...dto,
      updatedAt: new Date(),
    };

    if (dto.priceMonthly !== undefined) {
      updateData.priceMonthly = String(dto.priceMonthly);
    }

    await this.db
      .update(subscriptionPlans)
      .set(updateData)
      .where(eq(subscriptionPlans.id, id));

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.db
      .update(subscriptionPlans)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id));

    return { message: 'Paket langganan dinonaktifkan' };
  }
}