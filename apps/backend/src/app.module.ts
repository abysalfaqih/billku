import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import * as Joi from 'joi';
import { ThrottlerModule } from '@nestjs/throttler';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { PackagesModule } from './modules/packages/packages.module';
import { CustomersModule } from './modules/customers/customers.module';
import { BillingModule } from './modules/billing/billing.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { RadiusDatabaseModule } from './database/radius-database.module';
import { RadiusModule } from './modules/radius/radius.module';
import { MikrotikModule } from './modules/mikrotik/mikrotik.module';
import { MikrotikConfigsModule } from './modules/mikrotik-configs/mikrotik-configs.module';
import { IpPoolsModule } from './modules/ip-pools/ip-pools.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { WhatsappConfigsModule } from './modules/whatsapp-configs/whatsapp-configs.module';
import { WhatsappTemplatesModule } from './modules/whatsapp-templates/whatsapp-templates.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SubscriptionPlansModule } from './modules/subscription-plans/subscription-plans.module';
import { TenantSubscriptionsModule } from './modules/tenant-subscriptions/tenant-subscriptions.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TenantInvoicesModule } from './modules/tenant-invoices/tenant-invoices.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { UsersModule } from './modules/users/users.module';
import { AreasModule } from './modules/areas/areas.module';
import { PortalModule } from './modules/portal/portal.module';
import { ActivityLogInterceptor } from './common/interceptors/activity-log.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        APP_PORT: Joi.number().default(3001),
        APP_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(3306),
        DB_USER: Joi.string().required(),
        DB_PASSWORD: Joi.string().allow('').default(''),
        DB_NAME: Joi.string().required(),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow('').default(''),
        JWT_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
        FRONTEND_URL: Joi.string().default('http://localhost:3002'),
        CLOUDINARY_CLOUD_NAME: Joi.string().required(),
        CLOUDINARY_API_KEY: Joi.string().required(),
        CLOUDINARY_API_SECRET: Joi.string().required(),
      }),
    }),

    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: 60000,   // 1 menit
      limit: 100,   // generous untuk dashboard
    }]),

    // Cron job system
    ScheduleModule.forRoot(),

    // Queue system (Redis)
    // BullModule.forRootAsync({
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     connection: {
    //       host: config.get<string>('REDIS_HOST'),
    //       port: config.get<number>('REDIS_PORT'),
    //     },
    //   }),
    // }),

    // // Queue system (Redis)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          password: config.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),

    DatabaseModule,
    RadiusDatabaseModule,
    AuthModule,
    PackagesModule,
    CustomersModule,
    BillingModule,
    PaymentsModule,
    SchedulerModule,
    MikrotikModule,
    RadiusModule,
    MikrotikConfigsModule,
    IpPoolsModule,
    WhatsAppModule,
    WhatsappConfigsModule,
    WhatsappTemplatesModule,
    ActivityLogsModule,
    ReportsModule,
    SubscriptionPlansModule,
    TenantSubscriptionsModule,
    TenantInvoicesModule,
    SubscriptionModule,
    TenantsModule,
    MonitoringModule,
    UsersModule,
    AreasModule,
    PortalModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ActivityLogInterceptor },
  ],
})
export class AppModule {}