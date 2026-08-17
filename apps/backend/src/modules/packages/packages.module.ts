import { Module } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';

@Module({
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService], // Di-export agar bisa dipakai CustomersModule nanti
})
export class PackagesModule {}