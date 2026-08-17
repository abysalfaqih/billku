import { IsString, IsEmail, MinLength, IsEnum, IsOptional, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  @IsOptional()
  password?: string;

  @IsEnum(['admin', 'staff'])
  @IsOptional()
  role?: 'admin' | 'staff';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}