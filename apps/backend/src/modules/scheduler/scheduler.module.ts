import { Module } from '@nestjs/common';
import { IsolirScheduler } from './isolir.scheduler';
import { SchedulerController } from './scheduler.controller';
import { MikrotikModule } from '../mikrotik/mikrotik.module';
import { RadiusModule } from '../radius/radius.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { WhatsappTemplatesModule } from '../whatsapp-templates/whatsapp-templates.module';
import { TenantSubscriptionsModule } from '../tenant-subscriptions/tenant-subscriptions.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    MikrotikModule,
    RadiusModule,
    WhatsAppModule,
    WhatsappTemplatesModule,
    TenantSubscriptionsModule,
    BillingModule,
  ],
  controllers: [SchedulerController],
  providers: [IsolirScheduler],
  exports: [IsolirScheduler],
})
export class SchedulerModule {}
