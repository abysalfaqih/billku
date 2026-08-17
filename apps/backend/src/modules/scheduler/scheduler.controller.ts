import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { IsolirScheduler } from './isolir.scheduler';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('scheduler')
export class SchedulerController {
  constructor(private isolirScheduler: IsolirScheduler) {}

  // Hanya super_admin yang bisa trigger manual
  @Post('trigger-isolir')
  @Roles('super_admin')
  @HttpCode(HttpStatus.OK)
  async triggerIsolir() {
    await this.isolirScheduler.runManually();
    return { message: 'Auto-isolir berhasil dijalankan secara manual' };
  }
}