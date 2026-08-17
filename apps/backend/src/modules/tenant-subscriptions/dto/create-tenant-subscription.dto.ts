import {
  IsString,
  IsInt,
  IsPositive,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTenantSubscriptionDto {
  @IsString()
  tenantId: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  planId: number;

  @IsEnum(['active', 'trial'])
  status: 'active' | 'trial' = 'active';

  // Durasi dalam bulan
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMonths: number = 1;

  // Harga yang dibayar (bisa custom/diskon)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountPaid: number = 0;

  @IsString()
  @IsOptional()
  notes?: string;
}