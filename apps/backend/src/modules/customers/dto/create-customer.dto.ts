import {
  IsString, IsEmail, IsOptional, IsInt, Min, Max, IsNotEmpty,
  IsDateString, IsBoolean, IsNumber, ValidateIf, IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCustomerDto {
  @IsEnum(['pppoe', 'hotspot'])
  @IsOptional()
  connectionType?: 'pppoe' | 'hotspot' = 'pppoe';

  @Type(() => Number) @IsInt() @IsOptional()
  mikrotikConfigId?: number;

  @IsString() @IsOptional()
  hotspotProfile?: string;

  @Type(() => Number) @IsInt()
  packageId: number;

  @Type(() => Number) @IsInt()
  areaId: number;

  @IsString() @IsNotEmpty()
  name: string;

  @IsEmail() @IsOptional()
  email?: string;

  @IsString() @IsNotEmpty()
  phone: string;

  @IsString() @IsOptional()
  address?: string;

  @IsString() @IsOptional()
  nik?: string;

  @IsString() @IsOptional()
  usernamePppoe?: string;

  @IsString() @IsOptional()
  passwordPppoe?: string;

  @IsString() @IsOptional()
  pppoeProfile?: string;

  @IsString() @IsOptional()
  ipAddress?: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(28)
  billingDate: number;

  @IsDateString() @IsOptional()
  installationDate?: string;

  @IsString() @IsOptional()
  notes?: string;

  @IsBoolean() @IsOptional()
  taxEnabled?: boolean = false;

  @ValidateIf((o) => o.taxEnabled === true)
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01) @Max(100)
  @IsOptional()
  taxPercent?: number;
}