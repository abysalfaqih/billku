import {
  IsString, IsEmail, IsOptional, IsInt, Min, Max,
  IsDateString, IsEnum, IsBoolean, IsNumber, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCustomerDto {
  @IsEnum(['pppoe', 'hotspot']) @IsOptional()
  connectionType?: 'pppoe' | 'hotspot';

  @Type(() => Number) @IsInt() @IsOptional()
  mikrotikConfigId?: number;

  @IsString() @IsOptional()
  hotspotProfile?: string;

  @Type(() => Number) @IsInt() @IsOptional()
  packageId?: number;

  @Type(() => Number) @IsInt() @IsOptional()
  areaId?: number;

  @IsString() @IsOptional() name?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() nik?: string;
  @IsString() @IsOptional() usernamePppoe?: string;
  @IsString() @IsOptional() passwordPppoe?: string;
  @IsString() @IsOptional() pppoeProfile?: string;
  @IsString() @IsOptional() ipAddress?: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(28) @IsOptional()
  billingDate?: number;

  @IsDateString() @IsOptional() installationDate?: string;
  @IsString() @IsOptional() notes?: string;

  @IsEnum(['active', 'isolated', 'suspended', 'terminated']) @IsOptional()
  status?: 'active' | 'isolated' | 'suspended' | 'terminated';

  @IsBoolean() @IsOptional() taxEnabled?: boolean;

  @ValidateIf((o) => o.taxEnabled === true)
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01) @Max(100) @IsOptional()
  taxPercent?: number;
}