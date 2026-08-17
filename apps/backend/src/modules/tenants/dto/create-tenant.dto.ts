import { IsString, IsNotEmpty, IsEmail, Matches, IsBoolean, IsOptional, IsNumber} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  // Slug: huruf kecil, angka, strip — dipakai untuk login
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug hanya boleh huruf kecil, angka, dan strip' })
  slug: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  address?: string;

  @IsBoolean() @IsOptional()
  bandwidthEnabled?: boolean = false;

  @IsString() @IsOptional()
  bandwidthDescription?: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @IsOptional()
  @Type(() => Number)
  bandwidthPriceMonthly?: number;
}