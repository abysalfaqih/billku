import { IsDateString, IsOptional } from 'class-validator';

export class ReportPeriodDto {
  @IsDateString()
  @IsOptional()
  startDate?: string; // YYYY-MM-DD, default: awal bulan ini

  @IsDateString()
  @IsOptional()
  endDate?: string;   // YYYY-MM-DD, default: hari ini
}