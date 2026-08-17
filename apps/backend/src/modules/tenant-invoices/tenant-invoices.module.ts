import { Module } from '@nestjs/common';
import { TenantInvoicesService } from './tenant-invoices.service';
import { TenantInvoicesController } from './tenant-invoices.controller';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [TenantInvoicesController],
  providers: [TenantInvoicesService],
})
export class TenantInvoicesModule {}