import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public() // ← tidak butuh JWT
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // 5 percobaan/menit per IP — cegah brute-force email/password (pola sama seperti portal.controller.ts)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip, req.headers['user-agent']);
  }

  @Public() // ← tidak butuh JWT
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  // Dipanggil otomatis oleh frontend tiap access token expired — beri limit lebih longgar
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public() // ← tidak butuh JWT
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  // Route ini TIDAK @Public() — wajib JWT + bisa semua role
  @Get('me')
  @SkipThrottle() // sudah dilindungi JWT, dan sering dipanggil saat load halaman
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}