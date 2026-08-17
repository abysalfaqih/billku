import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsBoolean,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubscriptionPlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  priceMonthly: number;

  // -1 untuk unlimited
  @Type(() => Number)
  @IsInt()
  @Min(-1)
  maxCustomers: number = 100;

  @Type(() => Number)
  @IsInt()
  @Min(-1)
  maxMikrotik: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(-1)
  maxIpPools: number = 5;

  @Type(() => Number)
  @IsInt()
  @Min(-1)
  maxUsers: number = 3;

  @IsBoolean()
  @IsOptional()
  hasWhatsapp?: boolean = false;

  @IsBoolean()
  @IsOptional()
  hasApiAccess?: boolean = false;

  @IsBoolean()
  @IsOptional()
  hasReports?: boolean = true;

  @IsString()
  @IsOptional()
  extraFeatures?: string;
}