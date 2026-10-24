import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdvancePreviewDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  customerId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  months: number;
}

export class CreateAdvancePaymentDto extends AdvancePreviewDto {
  // Awal periode PERTAMA yang terlihat di pratinjau. Dicocokkan lagi dengan rencana
  // terbaru di server: kalau berbeda (pratinjau basi, atau tombol tertekan dua kali)
  // pembayaran ditolak, jadi tidak ada bulan yang terbayar dobel.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fromPeriodStart harus berformat YYYY-MM-DD' })
  fromPeriodStart: string;

  @IsEnum(['cash', 'transfer', 'other'], {
    message: 'Metode pembayaran tidak valid',
  })
  paymentMethod: 'cash' | 'transfer' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
