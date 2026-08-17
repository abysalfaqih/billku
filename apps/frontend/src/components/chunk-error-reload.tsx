import { useEffect } from 'react';

const STORAGE_KEY = 'billku-chunk-reload-at';
const COOLDOWN_MS = 10_000; // jangan reload berkali-kali dalam 10 detik terakhir

function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? `${error.name} ${error.message}`
        : '';
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(
    message,
  );
}

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) return; // sudah pernah reload baru-baru ini, jangan looping
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // sessionStorage tidak tersedia (mis. private mode) — tetap lanjut reload
  }
  window.location.reload();
}

/**
 * Menangkap ChunkLoadError yang muncul akibat chunk JS lama sudah tidak ada lagi
 * di server (misalnya setelah rebuild dev server, atau setelah deploy baru
 * menimpa file build lama). Alih-alih membiarkan halaman blank/stuck sampai
 * user reload manual, komponen ini otomatis me-reload sekali secara diam-diam.
 *
 * Dipasang sekali di root providers, jadi berlaku untuk seluruh halaman.
 */
export function ChunkErrorReload() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        reloadOnce();
      }
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        reloadOnce();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}