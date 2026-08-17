import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { RadiusModule } from '../radius/radius.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { WhatsappTemplatesModule } from '../whatsapp-templates/whatsapp-templates.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MikrotikModule } from '../mikrotik/mikrotik.module';

@Module({
  imports: [
    RadiusModule,
    WhatsAppModule,
    WhatsappTemplatesModule,
    SubscriptionModule,
    MikrotikModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
