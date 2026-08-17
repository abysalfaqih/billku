import { Module } from '@nestjs/common';
import { WhatsappTemplatesService } from './whatsapp-templates.service';
import { WhatsappTemplatesController } from './whatsapp-templates.controller';

@Module({
  controllers: [WhatsappTemplatesController],
  providers: [WhatsappTemplatesService],
  exports: [WhatsappTemplatesService],
})
export class WhatsappTemplatesModule {}
