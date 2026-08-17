import {
  IsString,
  IsOptional,
  IsEmail,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

class BankAccountDto {
  @IsString() bankName: string;
  @IsString() accountNumber: string;
  @IsString() accountName: string;
}

export class UpdateTenantProfileDto {
  @IsString() @IsOptional() name?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() motto?: string;
  @IsString() @IsOptional() about?: string;

  @IsBoolean() @IsOptional()
  bandwidthEnabled?: boolean = false;

  @IsString() @IsOptional()
  bandwidthDescription?: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @IsOptional()
  @Type(() => Number)
  bandwidthPriceMonthly?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankAccountDto)
  @IsOptional()
  bankAccounts?: BankAccountDto[];
}