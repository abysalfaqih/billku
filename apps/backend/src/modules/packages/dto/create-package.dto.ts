import {
  IsString, IsNumber, IsPositive, IsOptional, IsInt, Min, IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePackageDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1, { message: 'Kecepatan download minimal 1 Mbps' })
  speedDownload: number;

  @IsInt()
  @Min(1, { message: 'Kecepatan upload minimal 1 Mbps' })
  speedUpload: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'Harga harus lebih dari 0' })
  price: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  ipPoolId?: number;
}