import {
  IsString,
  IsOptional,
  IsEmail,
  Matches,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BankAccountDto {
  @IsString() bankName: string;
  @IsString() accountNumber: string;
  @IsString() accountName: string;
}

// Dipakai super_admin untuk mengedit data mitra manapun dari halaman Mitra.
// Beda dengan UpdateTenantProfileDto (dipakai tenant untuk edit profil miliknya
// sendiri) — DTO ini menambahkan `slug` karena super_admin boleh mengubah kode
// login mitra, sesuatu yang sengaja tidak diizinkan lewat endpoint "me/profile".
export class UpdateTenantDto {
  @IsString() @IsOptional() name?: string;

  // Slug: huruf kecil, angka, strip — dipakai untuk login
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug hanya boleh huruf kecil, angka, dan strip',
  })
  slug?: string;

  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() motto?: string;
  @IsString() @IsOptional() about?: string;

  @IsBoolean()
  @IsOptional()
  bandwidthEnabled?: boolean;

  @IsString()
  @IsOptional()
  bandwidthDescription?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Type(() => Number)
  bandwidthPriceMonthly?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankAccountDto)
  @IsOptional()
  bankAccounts?: BankAccountDto[];
}
