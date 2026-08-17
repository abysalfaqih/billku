import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RadiusModule } from '../radius/radius.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { WhatsappTemplatesModule } from '../whatsapp-templates/whatsapp-templates.module';

@Module({
  imports: [RadiusModule, WhatsAppModule, WhatsappTemplatesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
