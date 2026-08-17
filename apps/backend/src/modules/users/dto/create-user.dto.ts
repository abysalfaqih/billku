import { IsString, IsEmail, MinLength, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsOptional()
  tenantId?: string; // hanya dipakai kalau requester adalah super_admin

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @IsEnum(['admin', 'staff'], { message: 'Role harus admin atau staff' })
  role: 'admin' | 'staff';
}