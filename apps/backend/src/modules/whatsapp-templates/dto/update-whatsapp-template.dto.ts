import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateWhatsappTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  content: string;
}
