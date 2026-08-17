import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { ActivityLogsService } from '../../modules/activity-logs/activity-logs.service';
import type { AuthUser } from '../decorators/current-user.decorator';

// Map method + path pattern → deskripsi aksi yang mudah dibaca
const ACTION_MAP: Array<[RegExp, string]> = [
  [/^POST \/auth\/login$/, 'Login'],
  [/^POST \/customers$/, 'Tambah Pelanggan'],
  [/^PUT \/customers\/\d+$/, 'Edit Pelanggan'],
  [/^DELETE \/customers\/\d+$/, 'Hapus Pelanggan'],
  [/^POST \/customers\/\d+\/reset-password$/, 'Reset Password PPPoE Pelanggan'],
  [/^POST \/customers\/sync-radius-all$/, 'Sinkronisasi RADIUS Massal'],
  [/^POST \/packages$/, 'Tambah Paket'],
  [/^PUT \/packages\/\d+$/, 'Edit Paket'],
  [/^DELETE \/packages\/\d+$/, 'Hapus Paket'],
  [/^POST \/billing\/generate\/\d+$/, 'Generate Tagihan'],
  [/^PUT \/billing\/\d+\/cancel$/, 'Batalkan Tagihan'],
  [/^POST \/payments$/, 'Tandai Lunas'],
  [/^POST \/mikrotik-configs$/, 'Tambah Konfigurasi Mikrotik'],
  [/^PUT \/mikrotik-configs\/\d+$/, 'Edit Konfigurasi Mikrotik'],
  [/^POST \/mikrotik-configs\/\d+\/test$/, 'Test Koneksi Mikrotik'],
  [/^DELETE \/mikrotik-configs\/\d+$/, 'Hapus Konfigurasi Mikrotik'],
  [/^POST \/ip-pools$/, 'Tambah IP Pool'],
  [/^DELETE \/ip-pools\/\d+$/, 'Hapus IP Pool'],
  [/^POST \/whatsapp-configs$/, 'Tambah Konfigurasi WA'],
  [/^POST \/whatsapp-configs\/\d+\/test$/, 'Test Kirim WA'],
  [/^DELETE \/whatsapp-configs\/\d+$/, 'Hapus Konfigurasi WA'],
  [/^PUT \/whatsapp-templates\/\w+$/, 'Edit Template Pesan WA'],
  [/^POST \/whatsapp-templates\/\w+\/reset$/, 'Reset Template Pesan WA'],
  [/^POST \/scheduler\/trigger-isolir$/, 'Trigger Manual Isolir'],
  [/^POST \/auth\/logout$/, 'Logout'],

  // ── Akun staff & tenant (sensitif — kontrol akses & identitas) ──────────
  [/^POST \/users$/, 'Tambah Akun Staff'],
  [/^PUT \/users\/\d+$/, 'Edit Akun Staff'],
  [/^PUT \/users\/\d+\/toggle-active$/, 'Aktifkan/Nonaktifkan Akun Staff'],
  [/^POST \/tenants$/, 'Tambah Tenant'],
  [/^PUT \/tenants\/me\/profile$/, 'Edit Profil Tenant'],
  [/^POST \/tenants\/me\/profile\/logo$/, 'Ubah Logo Tenant'],
  [/^POST \/tenants\/me\/profile\/favicon$/, 'Ubah Favicon Tenant'],
  [/^PUT \/tenants\/[\w-]+\/toggle-active$/, 'Aktifkan/Nonaktifkan Tenant'],

  // ── Paket langganan SaaS & tagihan antar-tenant (sensitif — finansial) ──
  [/^POST \/subscription-plans$/, 'Tambah Paket Langganan'],
  [/^PUT \/subscription-plans\/\d+$/, 'Edit Paket Langganan'],
  [/^DELETE \/subscription-plans\/\d+$/, 'Hapus Paket Langganan'],
  [/^POST \/tenant-subscriptions$/, 'Tambah Langganan Tenant'],
  [/^DELETE \/tenant-subscriptions\/\d+$/, 'Hapus Langganan Tenant'],
  [/^POST \/tenant-invoices$/, 'Buat Invoice Tenant'],
  [
    /^POST \/tenant-invoices\/[\w-]+\/auto-bandwidth$/,
    'Generate Invoice Bandwidth Otomatis',
  ],
  [/^PUT \/tenant-invoices\/\d+\/status$/, 'Ubah Status Invoice Tenant'],

  [/^POST \/areas$/, 'Tambah Area'],
  [/^DELETE \/areas\/\d+$/, 'Hapus Area'],
];

function deriveAction(method: string, path: string): string {
  // Hapus prefix /api/v1 dan query string
  const cleanPath = path.replace(/\/api\/v1/, '').split('?')[0];
  const key = `${method} ${cleanPath}`;

  for (const [pattern, action] of ACTION_MAP) {
    if (pattern.test(key)) return action;
  }

  return `${method} ${cleanPath}`;
}

// Ambil id resource dari path, mis. "/customers/42/reset-password" → "42"
// Support angka (bigint autoincrement) maupun UUID (mis. id tenant)
const TARGET_ID_PATTERN =
  /\/(\d+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?=\/|$)/;

function extractTargetId(path: string): string | undefined {
  const cleanPath = path.replace(/\/api\/v1/, '').split('?')[0];
  return TARGET_ID_PATTERN.exec(cleanPath)?.[1];
}

// Field yang tidak boleh pernah masuk ke audit log meski di dalam body request
const SENSITIVE_KEY_PATTERN =
  /password|secret|token|apikey|api[_-]?key|pin\b|otp/i;
const MAX_STRING_LENGTH = 300;
const MAX_DEPTH = 4;

// Sensor field rahasia (password, secret, token, dst) sebelum disimpan ke activity log,
// supaya log "siapa mengubah apa" tidak justru jadi tempat bocor kredensial.
function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[terlalu dalam]';

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeForAudit(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? '***disensor***'
        : sanitizeForAudit(val, depth + 1);
    }
    return result;
  }

  if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
    return `${value.slice(0, MAX_STRING_LENGTH)}…(dipotong)`;
  }

  return value;
}

function buildMetadata(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    return undefined;
  }
  return sanitizeForAudit(body) as Record<string, unknown>;
}

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private activityLogsService: ActivityLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const startTime = Date.now();

    const SKIP_METHODS = ['GET', 'HEAD', 'OPTIONS'];
    const SKIP_PATHS = ['/api/v1/auth/refresh'];

    const shouldSkip =
      SKIP_METHODS.includes(request.method) ||
      SKIP_PATHS.some((p) => request.url.startsWith(p));

    if (shouldSkip) {
      return next.handle();
    }

    const targetIdFromPath = extractTargetId(request.url);
    const metadata = buildMetadata(request.body);

    return next.handle().pipe(
      tap({
        next: (responseBody: unknown) => {
          const response = context.switchToHttp().getResponse<Response>();
          // Untuk POST create, id resource baru biasanya baru ada di response, bukan di path
          const targetId =
            targetIdFromPath ??
            (responseBody &&
            typeof responseBody === 'object' &&
            'id' in responseBody
              ? String(responseBody.id)
              : undefined);

          this.activityLogsService.log({
            tenantId: request.user?.tenantId,
            userId: request.user?.userId,
            userEmail: request.user?.email,
            method: request.method,
            path: request.url,
            action: deriveAction(request.method, request.url),
            targetId,
            metadata,
            ipAddress:
              (request.headers['x-forwarded-for'] as string)?.split(',')[0] ??
              request.ip,
            userAgent: request.headers['user-agent'],
            statusCode: response.statusCode,
            durationMs: Date.now() - startTime,
          });
        },
        error: (err: { status?: number }) => {
          this.activityLogsService.log({
            tenantId: request.user?.tenantId,
            userId: request.user?.userId,
            userEmail: request.user?.email,
            method: request.method,
            path: request.url,
            action: deriveAction(request.method, request.url),
            targetId: targetIdFromPath,
            // Tetap simpan metadata walau gagal — mis. percobaan login dengan email
            // apa yang salah, penting untuk investigasi keamanan
            metadata,
            ipAddress:
              (request.headers['x-forwarded-for'] as string)?.split(',')[0] ??
              request.ip,
            userAgent: request.headers['user-agent'],
            statusCode: err.status ?? 500,
            durationMs: Date.now() - startTime,
          });
        },
      }),
    );
  }
}