import { Transform } from 'class-transformer';

// Rapikan nama: spasi/tab/baris-baru berurutan jadi satu spasi, spasi di
// ujung dibuang. Nama mitra dipakai sebagai judul tab browser, dan browser
// merapikan judul dengan aturan yang sama — nama yang tidak rapi dulu pernah
// membuat frontend berputar tanpa henti (lihat branding-sync.tsx).
export function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

// Dekorator DTO: terapkan normalizeName pada field string (non-string dibiarkan
// supaya validator @IsString yang menolaknya).
export const NormalizeName = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeName(value) : value,
  );
