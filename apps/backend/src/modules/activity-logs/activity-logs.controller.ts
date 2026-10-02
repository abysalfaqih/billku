import { Controller, Get, Query } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private activityLogsService: ActivityLogsService) {}

  @Get()
  findAll(
    @Query() query: QueryActivityLogDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.activityLogsService.findAll(query, user);
  }
}