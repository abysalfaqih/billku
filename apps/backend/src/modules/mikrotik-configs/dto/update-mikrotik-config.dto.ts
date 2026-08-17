import { PartialType } from '@nestjs/mapped-types';
import { CreateMikrotikConfigDto } from './create-mikrotik-config.dto';

// Semua field jadi opsional (PartialType tetap menjaga validator asli
// seperti IsIP/Min/Max, hanya dilewati kalau field tidak dikirim).
// Khusus `password` & `radiusSecret`: kalau dikirim string kosong,
// service akan menganggapnya "tidak diubah" (lihat MikrotikConfigsService.update).
export class UpdateMikrotikConfigDto extends PartialType(CreateMikrotikConfigDto) {}