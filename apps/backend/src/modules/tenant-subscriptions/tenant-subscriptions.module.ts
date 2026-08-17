import { Module } from '@nestjs/common';
import { TenantSubscriptionsService } from './tenant-subscriptions.service';
import { TenantSubscriptionsController } from './tenant-subscriptions.controller';

@Module({
  controllers: [TenantSubscriptionsController],
  providers: [TenantSubscriptionsService],
  exports: [TenantSubscriptionsService],
})
export class TenantSubscriptionsModule {}