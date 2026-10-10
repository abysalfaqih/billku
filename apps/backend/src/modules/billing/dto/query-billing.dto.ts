import { IsOptional, IsEnum, IsInt, Min, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryBillingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['unpaid', 'paid', 'overdue', 'cancelled'])
  status?: 'unpaid' | 'paid' | 'overdue' | 'cancelled';

  // Filter tagihan milik 1 pelanggan tertentu
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  // Cari berdasarkan No. Tagihan, nama / No. HP / kode pelanggan (dipakai
  // pencarian topbar). Panjang dibatasi supaya pola LIKE tidak berlebihan.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}