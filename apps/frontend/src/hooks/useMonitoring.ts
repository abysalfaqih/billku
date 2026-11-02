import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';

/**
 * Keadaan sesi (dihitung backend):
 *  online · offline (router menjawab, tidak ada sesi) · disabled (akun hotspot dinonaktifkan)
 *  · missing (akun hotspot tidak ada di router) · unreachable (router tidak menjawab — sesi TIDAK diketahui)
 *  · unconfigured (data pelanggan belum lengkap)
 */
export type SessionState = 'online' | 'offline' | 'disabled' | 'missing' | 'unreachable' | 'unconfigured';

export interface SessionInfo {
  address: string;
  uptime: string;
  callerId?: string;
  macAddress?: string;
  bytesIn?: string;
  bytesOut?: string;
}

export interface SessionResponse {
  state: SessionState;
  found: boolean;
  connected?: boolean;
  connectionType: 'pppoe' | 'hotspot';
  customerName: string;
  customerStatus?: string;
  username?: string | null;
  mikrotikId?: number;
  mikrotikName?: string;
  hotspotProfile?: string | null;
  reason?: string;
  /** jenis galat bila state = unreachable ('server' = server billku sendiri tidak menjawab) */
  errorKind?: string;
  /** akun hotspot hilang dari router dan boleh dibuat ulang lewat tombol Sinkronkan */
  canSync?: boolean;
  session?: SessionInfo;
  /** semua sesi aktif (hotspot yang dipakai di lebih dari satu perangkat) */
  sessions?: SessionInfo[];
  traffic?: { rxBps: number; txBps: number } | null;
}

export interface TrafficResponse {
  available: boolean;
  rxBps?: number;
  txBps?: number;
  reason?: string;
}

// Batas waktu sisi browser. Backend sendiri membatasi router ±8 dtk; angka di bawah memberi
// ruang untuk jaringan, supaya tampilan TIDAK PERNAH berputar tanpa ujung.
export const SESSION_TIMEOUT_MS = 20_000;
export const TRAFFIC_TIMEOUT_MS = 15_000;
export const SEARCH_TIMEOUT_MS = 15_000;
const ACTION_TIMEOUT_MS = 35_000;

export function fetchCustomerSession(customerId: number): Promise<SessionResponse> {
  return api
    .get(`/monitoring/customers/${customerId}/session`, { timeout: SESSION_TIMEOUT_MS })
    .then((r) => r.data as SessionResponse);
}

export function useSessionTraffic() {
  return useMutation({
    mutationFn: (customerId: number) =>
      api
        .get(`/monitoring/customers/${customerId}/traffic`, { timeout: TRAFFIC_TIMEOUT_MS })
        .then((r) => r.data as TrafficResponse),
  });
}

export function useKickSession() {
  return useMutation({
    mutationFn: (customerId: number) =>
      api.post(`/monitoring/customers/${customerId}/kick`, undefined, { timeout: ACTION_TIMEOUT_MS }).then(r => r.data),
    onSuccess: (data) => {
      if (data.success) toast.success(data.message ?? 'Sesi berhasil diputus');
      else toast.error(data.reason ?? 'Gagal memutus sesi');
    },
    onError: () => toast.error('Gagal memutus sesi'),
  });
}

/** Membuat/memperbarui akun voucher di router yang dipilih pelanggan. */
export function useSyncHotspot(onDone?: () => void) {
  return useMutation({
    mutationFn: (customerId: number) =>
      api.post(`/monitoring/customers/${customerId}/sync`, undefined, { timeout: ACTION_TIMEOUT_MS }).then(r => r.data as { success: boolean; message?: string; reason?: string }),
    onSuccess: (data) => {
      if (data.success) toast.success(data.message ?? 'Akun berhasil disinkronkan');
      else toast.error(data.reason ?? 'Gagal menyinkronkan akun');
      onDone?.();
    },
    onError: () => toast.error('Server tidak merespons. Coba lagi sebentar lagi.'),
  });
}

export function useResetPassword(onSuccess?: () => void) {
  return useMutation({
    mutationFn: ({ customerId, newPassword }: { customerId: number; newPassword: string }) =>
      api.post(`/customers/${customerId}/reset-password`, { newPassword }).then(r => r.data),
    onSuccess: () => {
      toast.success('Password berhasil direset');
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Gagal reset password');
    },
  });
}