import { Module } from '@nestjs/common';
import { MikrotikConfigsService } from './mikrotik-configs.service';
import { MikrotikConfigsController } from './mikrotik-configs.controller';
import { MikrotikModule } from '../mikrotik/mikrotik.module';
import { RadiusModule } from '../radius/radius.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [MikrotikModule, RadiusModule, SubscriptionModule],
  controllers: [MikrotikConfigsController],
  providers: [MikrotikConfigsService],
  exports: [MikrotikConfigsService],
})
export class MikrotikConfigsModule {}