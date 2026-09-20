import {
  IsInt,
  IsPositive,
  IsNumber,
  IsOptional,
  IsEnum,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// Dipakai untuk mengoreksi record langganan yang SUDAH ADA (mis. salah paket,
// salah durasi/nominal saat input, atau perlu perbaikan status) — tanpa
// membuat baris riwayat baru. Untuk skenario "mitra resmi ganti paket" yang
// sifatnya pergantian (bukan koreksi), tetap gunakan POST /tenant-subscriptions
// (endpoint create) karena itu otomatis membatalkan langganan lama dan mencatat
// langganan baru sebagai baris terpisah — riwayat langganan mitra jadi tetap utuh.
export class UpdateTenantSubscriptionDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  planId?: number;

  @IsEnum(['active', 'expired', 'trial', 'cancelled'])
  @IsOptional()
  status?: 'active' | 'expired' | 'trial' | 'cancelled';

  // Durasi dalam bulan — kalau diubah, tanggal berakhir dihitung ulang dari
  // tanggal mulai (startedAt) yang sudah ada, BUKAN dari sekarang.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  durationMonths?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  amountPaid?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
