import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as radiusSchema from './radius-schema';

export const RADIUS_DB = Symbol('RADIUS_DB');
export type RadiusClient = MySql2Database<typeof radiusSchema>;

@Global()
@Module({
  providers: [
    {
      provide: RADIUS_DB,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const pool = mysql.createPool({
          host: config.get<string>('DB_HOST'),
          port: config.get<number>('DB_PORT'),
          user: config.get<string>('DB_USER'),
          password: config.get<string>('DB_PASSWORD') || undefined,
          // Database isp_radius — terpisah dari isp_billku
          database: config.get<string>('RADIUS_DB_NAME'),
          connectionLimit: 10,
          waitForConnections: true,
        });
        return drizzle(pool, { schema: radiusSchema, mode: 'default' });
      },
    },
  ],
  exports: [RADIUS_DB],
})
export class RadiusDatabaseModule {}