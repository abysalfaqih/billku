import {
  Controller, Get, Post, Param, Query, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('monitoring')
export class MonitoringController {
  constructor(private service: MonitoringService) {}

  @Get('search')
  search(@Query('q') q: string, @CurrentUser() user: AuthUser) {
    return this.service.searchCustomers(q ?? '', user);
  }

  @Get('customers/:id/session')
  getSession(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.getCustomerSession(id, user);
  }

  @Get('customers/:id/traffic')
  getTraffic(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.getSessionTraffic(id, user);
  }

  @Post('customers/:id/kick')
  @HttpCode(HttpStatus.OK)
  kickSession(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.kickSession(id, user);
  }
}