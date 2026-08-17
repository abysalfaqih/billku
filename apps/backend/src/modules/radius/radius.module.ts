import { Module } from '@nestjs/common';
import { RadiusService } from './radius.service';

@Module({
  providers: [RadiusService],
  exports: [RadiusService], // Di-export agar bisa dipakai modul lain
})
export class RadiusModule {}