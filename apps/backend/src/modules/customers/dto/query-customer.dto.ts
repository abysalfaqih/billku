import { IsOptional, IsEnum, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryCustomerDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['active', 'isolated', 'suspended', 'terminated'])
  status?: 'active' | 'isolated' | 'suspended' | 'terminated';

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  packageId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  areaId?: number;
}