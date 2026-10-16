import { IsOptional, IsInt, Min, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryPaymentDto {
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
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  // Cari berdasarkan No. Tagihan, nama / No. HP / kode pelanggan. Panjang
  // dibatasi supaya pola LIKE tidak berlebihan (sama seperti QueryBillingDto).
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
