import {
  IsString, IsInt, IsNumber, IsOptional, IsArray,
  ValidateNested, IsEnum, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class InvoiceItemDto {
  @IsString() description: string;
  @IsNumber() @Min(1) qty: number;
  @IsNumber() @Min(0) unitPrice: number;
  @IsNumber() @Min(0) @Max(100) discPercent: number = 0;
  @IsEnum(['P', 'N']) tax: 'P' | 'N' = 'P';
}

export class CreateTenantInvoiceDto {
  @IsString() tenantId: string;

  @IsInt() @Min(1) @Max(12) periodMonth: number;
  @IsInt() @Min(2020) periodYear: number;

  @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @IsNumber() @Min(0) ppnPercent: number = 11;
  @IsNumber() @Min(0) discountAmount: number = 0;

  @IsString() @IsOptional() paymentDescription?: string;
  @IsString() @IsOptional() authorizedBy?: string;
  @IsString() @IsOptional() authorizedTitle?: string;
  @IsString() @IsOptional() notes?: string;
}