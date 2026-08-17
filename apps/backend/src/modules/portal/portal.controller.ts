import { Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';
import { PortalService } from './portal.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('portal')
@Public()
@UseGuards(ThrottlerGuard)
export class PortalController {
  constructor(private service: PortalService) {}

  @Get(':slug')
  @SkipThrottle()  // GET info publik, tidak perlu dibatasi
  getTenantInfo(@Param('slug') slug: string) {
    return this.service.getTenantInfo(slug);
  }

  @Post(':slug/lookup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })  // 5 percobaan/menit per IP
  lookup(@Param('slug') slug: string, @Body() body: { phone: string }) {
    return this.service.lookupCustomer(slug, body.phone);
  }
}