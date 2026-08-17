import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsIP,
} from 'class-validator';
import { Type } from 'class-transformer';

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
}