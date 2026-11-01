import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';

/**
 * Pengganti daftar saat data gagal dimuat dan belum ada data lama yang bisa ditampilkan.
 * Tanpa ini halaman daftar menampilkan "belum ada ..." — padahal datanya hanya gagal diambil
 * (koneksi putus / server bermasalah), sehingga admin bisa mengira datanya memang kosong.
 *
 * Tampilannya sengaja sama dengan kartu "kosong" yang sudah dipakai halaman-halaman daftar.
 */
export function QueryError({
  onRetry,
  title = 'Gagal memuat data',
  description = 'Periksa koneksi internet Anda, lalu coba lagi.',
}: {
  onRetry: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <div
      role="alert"
      style={{
        textAlign: 'center', padding: '60px 24px', marginTop: 8,
        background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
      }}
    >
      <AlertTriangle size={32} style={{ color: '#EF4444', margin: '0 auto 12px' }} aria-hidden="true" />
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{title}</p>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{description}</p>
      <Button
        size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={onRetry}
        style={{ marginTop: 16 }}
      >
        Coba lagi
      </Button>
    </div>
  );
}
