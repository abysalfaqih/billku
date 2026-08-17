import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
} from 'class-validator';

export class CreateWhatsappConfigDto {
  @IsEnum(['fonnte', 'wablast', 'meta'])
  provider: 'fonnte' | 'wablast' | 'meta';

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsString()
  @IsNotEmpty()
  senderNumber: string;

  // Meta: JSON string berisi { "phone_number_id": "xxx" }
  @IsString()
  @IsOptional()
  extraConfig?: string;
}