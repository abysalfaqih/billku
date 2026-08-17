import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, count, desc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { activityLogs } from '../../database/schema';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { QueryActivityLogDto } from './dto/query-activity-log.dto';

export interface CreateActivityLogDto {
  tenantId?: string;
  userId?: number;
  userEmail?: string;
  method: string;
  path: string;
  action: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  statusCode: number;
  durationMs: number;
}

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  // Fire-and-forget — tidak blocking request utama
  log(data: CreateActivityLogDto): void {
    this.db
      .insert(activityLogs)
      .values({
        tenantId: data.tenantId,
        userId: data.userId,
        userEmail: data.userEmail,
        method: data.method,
        path: data.path,
        action: data.action,
        targetId: data.targetId,
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        statusCode: data.statusCode,
        durationMs: data.durationMs,
      })
      .catch(err => this.logger.error(`Gagal simpan activity log: ${err}`));
  }

  async findAll(query: QueryActivityLogDto, user: AuthUser) {
    const { page = 1, limit = 50, startDate, endDate, action } = query;
    const offset = (page - 1) * limit;

    const where = and(
      eq(activityLogs.tenantId, user.tenantId),
      action ? eq(activityLogs.action, action) : undefined,
      startDate
        ? sql`DATE(${activityLogs.createdAt}) >= ${startDate}`
        : undefined,
      endDate
        ? sql`DATE(${activityLogs.createdAt}) <= ${endDate}`
        : undefined,
    );

    const [data, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(activityLogs)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(activityLogs.createdAt)),
      this.db.select({ total: count() }).from(activityLogs).where(where),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}