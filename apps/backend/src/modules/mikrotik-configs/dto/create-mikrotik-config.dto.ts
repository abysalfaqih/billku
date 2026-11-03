import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsIP,
  IsIn,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ROUTER_ROLES } from '../../../database/schema';
import type { RouterRole } from '../../../database/schema';

export class CreateMikrotikConfigDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIP('4', { message: 'Host harus berupa IP address yang valid' })
  host: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number = 8728;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  password: string;

  // Secret yang dikonfigurasi di Mikrotik → RADIUS → secret
  @IsString()
  @IsNotEmpty()
  radiusSecret: string;

  // Peran router: 'pppoe' | 'hotspot' | 'both'. Tidak dikirim = 'both'
  // (saat membuat) atau tidak diubah (saat mengedit).
  @IsOptional()
  @IsIn(ROUTER_ROLES, { message: 'Peran router harus pppoe, hotspot, atau both' })
  role?: RouterRole;
}
