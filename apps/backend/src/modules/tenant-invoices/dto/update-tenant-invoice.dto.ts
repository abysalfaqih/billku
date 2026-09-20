import {
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class InvoiceItemDto {
  @IsString() description: string;
  @IsNumber() @Min(1) qty: number;
  @IsNumber() @Min(0) unitPrice: number;
  @IsNumber() @Min(0) @Max(100) discPercent: number = 0;
  @IsEnum(['P', 'N']) tax: 'P' | 'N' = 'P';
}

// Semua field opsional (edit sebagian). `tenantId` sengaja TIDAK ada di sini —
// invoice yang salah mitra sebaiknya dihapus lalu dibuat ulang, bukan
// dipindah-pindah tenant-nya, supaya nomor invoice & riwayat tetap konsisten.
export class UpdateTenantInvoiceDto {
  @IsInt() @Min(1) @Max(12) @IsOptional() periodMonth?: number;
  @IsInt() @Min(2020) @IsOptional() periodYear?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  @IsOptional()
  items?: InvoiceItemDto[];

  @IsNumber() @Min(0) @IsOptional() ppnPercent?: number;
  @IsNumber() @Min(0) @IsOptional() discountAmount?: number;

  @IsString() @IsOptional() paymentDescription?: string;
  @IsString() @IsOptional() authorizedBy?: string;
  @IsString() @IsOptional() authorizedTitle?: string;
  @IsString() @IsOptional() notes?: string;

  @IsEnum(['draft', 'sent', 'paid'])
  @IsOptional()
  status?: 'draft' | 'sent' | 'paid';
}
