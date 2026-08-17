import {
  IsInt,
  IsPositive,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  billId: number;

  @IsEnum(['cash', 'transfer', 'other'], {
    message: 'Metode pembayaran tidak valid',
  })
  paymentMethod: 'cash' | 'transfer' | 'other';

  @IsOptional()
  @IsString()
  notes?: string;
}