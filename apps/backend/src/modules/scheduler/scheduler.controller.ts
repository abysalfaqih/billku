import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { IsolirScheduler } from './isolir.scheduler';
import { CleanupScheduler } from './cleanup.scheduler';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('scheduler')
export class SchedulerController {
  constructor(
    private isolirScheduler: IsolirScheduler,
    private cleanupScheduler: CleanupScheduler,
  ) {}

  // Jalankan pembersihan tabel log sekarang juga (tanpa menunggu jadwal Minggu 03:00)
  @Post('trigger-cleanup')
  @Roles('super_admin')
  @HttpCode(HttpStatus.OK)
  async triggerCleanup() {
    const results = await this.cleanupScheduler.run();
    return { message: 'Pembersihan tabel log selesai dijalankan', results };
  }

  // Hanya super_admin yang bisa trigger manual
  @Post('trigger-isolir')
  @Roles('super_admin')
  @HttpCode(HttpStatus.OK)
  async triggerIsolir() {
    const { isolir, reminders } = await this.isolirScheduler.runManually();
    return {
      message:
        isolir.failed.length > 0
          ? `Auto-isolir dijalankan, tetapi ${isolir.failed.length} pelanggan gagal diputus jaringannya`
          : 'Auto-isolir berhasil dijalankan secara manual',
      isolir,
      reminders,
    };
  }
}