import { Module } from '@nestjs/common';
import { IpPoolsService } from './ip-pools.service';
import { IpPoolsController } from './ip-pools.controller';
import { MikrotikModule } from '../mikrotik/mikrotik.module';
import { RadiusModule } from '../radius/radius.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [MikrotikModule, RadiusModule, SubscriptionModule],
  controllers: [IpPoolsController],
  providers: [IpPoolsService],
  exports: [IpPoolsService],
})
export class IpPoolsModule {}