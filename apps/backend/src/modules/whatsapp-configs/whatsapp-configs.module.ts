import { Module } from '@nestjs/common';
import { WhatsappConfigsService } from './whatsapp-configs.service';
import { WhatsappConfigsController } from './whatsapp-configs.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { SubscriptionModule } from '../subscription/subscription.module'; // ← tambahkan

@Module({
  imports: [
    WhatsAppModule,
    SubscriptionModule,   // ← tambahkan
  ],
  controllers: [WhatsappConfigsController],
  providers: [WhatsappConfigsService],
})
export class WhatsappConfigsModule {}