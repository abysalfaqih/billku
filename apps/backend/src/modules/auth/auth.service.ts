import {
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { tenants, users, refreshTokens } from '../../database/schema';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    // 1. Cari tenant berdasarkan slug
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(and(eq(tenants.slug, dto.tenantSlug), eq(tenants.isActive, true)))
      .limit(1);

    if (!tenant) {
      throw new UnauthorizedException('Tenant tidak ditemukan atau tidak aktif');
    }

    // 2. Cari user berdasarkan email + tenant
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, dto.email),
          eq(users.tenantId, tenant.id),
          eq(users.isActive, true),
        ),
      )
      .limit(1);

    // Pesan error sengaja dibuat sama (tidak bocorkan info user exist atau tidak)
    if (!user) {
      throw new UnauthorizedException('Email atau password salah');
    }

    // 3. Verifikasi password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email atau password salah');
    }

    // 4. Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      tenant.id,
      user.role,
      user.email,
    );

    // 5. Simpan refresh token (hashed)
    await this.saveRefreshToken(
      user.id,
      tenant.id,
      tokens.refreshToken,
      ipAddress,
      userAgent,
    );

    // 6. Update last login
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: tenant.id,
      },
    };
  }

  async refresh(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const [stored] = await this.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          eq(refreshTokens.isRevoked, false),
        ),
      )
      .limit(1);

    if (!stored) {
      throw new UnauthorizedException('Refresh token tidak valid');
    }

    if (new Date() > stored.expiresAt) {
      // Token expired — revoke dan minta login ulang
      await this.db
        .update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.id, stored.id));
      throw new UnauthorizedException('Sesi telah berakhir, silakan login kembali');
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, stored.userId))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User tidak aktif');
    }

    // Revoke token lama (rotation — setiap refresh hasilkan token baru)
    await this.db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.id, stored.id));

    // Generate token baru
    const tokens = await this.generateTokens(
      user.id,
      stored.tenantId,
      user.role,
      user.email,
    );
    await this.saveRefreshToken(user.id, stored.tenantId, tokens.refreshToken);

    return tokens;
  }

  async logout(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.tokenHash, tokenHash));
    return { message: 'Logout berhasil' };
  }

  // ─── Private Helpers ───────────────────────────────────────────────

  private async generateTokens(
    userId: number,
    tenantId: string,
    role: string,
    email: string,
    ) {
    const payload: JwtPayload = {
        sub: userId,
        tenantId,
        role: role as JwtPayload['role'],
        email,
    };

    const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET')!,          // ← tambah !
        expiresIn: (this.config.get<string>('JWT_EXPIRES_IN') ?? '15m') as any, // ← cast any
        }),
        Promise.resolve(randomBytes(64).toString('hex')),
    ]);

    return { accessToken, refreshToken };
    }

  private async saveRefreshToken(
    userId: number,
    tenantId: string,
    token: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.db.insert(refreshTokens).values({
      userId,
      tenantId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    });
  }
}