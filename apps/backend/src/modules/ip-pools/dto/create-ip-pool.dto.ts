import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsPositive,
  Matches,
  IsIP,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIpPoolDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  mikrotikConfigId: number;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  // Slug: hanya huruf kecil, angka, strip
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Nama hanya boleh huruf kecil, angka, dan strip (-)',
  })
  name: string;

  // Format CIDR: 192.168.10.0/24
  @IsString()
  @Matches(/^(\d{1,3}\.){3}\d{1,3}\/(\d|[1-2]\d|3[0-2])$/, {
    message: 'Network harus dalam format CIDR yang valid, contoh: 192.168.10.0/24',
  })
  network: string;

  @IsIP('4')
  @IsOptional()
  dnsPrimary?: string = '8.8.8.8';

  @IsIP('4')
  @IsOptional()
  dnsSecondary?: string = '8.8.4.4';
}