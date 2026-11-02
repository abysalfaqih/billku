// Logika murni penampil sesi Monitoring (tanpa React) — dipisah supaya mudah diuji.
import type { SessionResponse, SessionState } from '@/hooks/useMonitoring';

/** Selang pengecekan sesi. */
export const SESSION_POLL_MS = 10_000;

/**
 * Berapa kali berturut-turut router gagal dijangkau sebelum tampilan berganti ke
 * "Router tidak dapat dihubungi". Kegagalan sesaat tidak boleh mengubah "Online" jadi "offline".
 */
export const FAIL_LIMIT = 3;

export interface ViewState {
  /** yang sedang ditampilkan */
  shown: SessionResponse | null;
  /** hasil terakhir yang BUKAN "router tidak terjangkau" */
  lastGood: { data: SessionResponse; at: number } | null;
  /** kegagalan berturut-turut sejak hasil baik terakhir */
  fails: number;
  /** bila tidak null: yang tampil adalah data lama, karena pengecekan terbaru gagal */
  stale: { reason: string } | null;
}

export const INITIAL_VIEW: ViewState = { shown: null, lastGood: null, fails: 0, stale: null };

/**
 * Menggabungkan hasil pengecekan baru ke tampilan.
 *  - hasil apa pun selain "unreachable" langsung menggantikan tampilan;
 *  - "unreachable" pertama dan kedua menahan data lama (bila ada) dan hanya memberi tanda "basi";
 *  - mulai kegagalan ke-FAIL_LIMIT, atau bila admin menekan Muat ulang (manual), kegagalan ditampilkan.
 */
export function applyResult(prev: ViewState, res: SessionResponse, now: number, manual = false): ViewState {
  if (res.state !== 'unreachable') {
    return { shown: res, lastGood: { data: res, at: now }, fails: 0, stale: null };
  }
  const fails = prev.fails + 1;
  if (!manual && prev.lastGood && fails < FAIL_LIMIT) {
    return { ...prev, shown: prev.lastGood.data, fails, stale: { reason: res.reason ?? 'Router tidak merespons.' } };
  }
  return { ...prev, shown: res, fails, stale: null };
}

/** Respons pengganti saat permintaan ke SERVER billku gagal (jaringan putus / waktu habis). */
export function requestFailed(base: { customerName: string; connectionType: 'pppoe' | 'hotspot' }): SessionResponse {
  return {
    state: 'unreachable',
    found: true,
    connected: false,
    connectionType: base.connectionType,
    customerName: base.customerName,
    errorKind: 'server',
    reason: 'Server tidak merespons. Periksa koneksi internet Anda, lalu coba lagi.',
  };
}

export interface StateLook {
  /** warna titik status */
  color: string;
  label: string;
}

/** Warna titik + label status (dipakai di header dan kartu pemberitahuan). */
export function lookOf(state: SessionState, type: 'pppoe' | 'hotspot'): StateLook {
  switch (state) {
    case 'online': return { color: '#10B981', label: 'Online' };
    case 'offline': return { color: '#6B7280', label: type === 'hotspot' ? 'Tidak sedang dipakai' : 'Tidak online' };
    case 'disabled': return { color: '#D97706', label: 'Dinonaktifkan di router' };
    case 'missing': return { color: '#EA580C', label: 'Voucher tidak ada di router' };
    case 'unreachable': return { color: '#CA8A04', label: 'Router tidak dapat dihubungi' };
    default: return { color: '#6B7280', label: 'Belum bisa dipantau' };
  }
}
