import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppProcessor } from './processors/whatsapp.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'whatsapp' }),
  ],
  providers: [WhatsAppService, WhatsAppProcessor],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}