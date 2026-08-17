import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export interface SessionResponse {
  found: boolean;
  connected?: boolean;
  connectionType: 'pppoe' | 'hotspot';
  customerName: string;
  username?: string;
  mikrotikId?: number;
  mikrotikName?: string;
  hotspotProfile?: string;
  reason?: string;
  session?: {
    address: string;
    uptime: string;
    callerId?: string;
    macAddress?: string;
    bytesIn?: string;
    bytesOut?: string;
  };
  traffic?: { rxBps: number; txBps: number } | null;
}

export interface TrafficResponse {
  available: boolean;
  rxBps?: number;
  txBps?: number;
  reason?: string;
}

export function useCustomerSession() {
  return useMutation({
    mutationFn: (customerId: number) =>
      api.get(`/monitoring/customers/${customerId}/session`).then(r => r.data as SessionResponse),
  });
}

export function useSessionTraffic() {
  return useMutation({
    mutationFn: (customerId: number) =>
      api.get(`/monitoring/customers/${customerId}/traffic`).then(r => r.data as TrafficResponse),
  });
}

export function useKickSession() {
  return useMutation({
    mutationFn: (customerId: number) =>
      api.post(`/monitoring/customers/${customerId}/kick`).then(r => r.data),
    onSuccess: (data) => {
      if (data.success) toast.success(data.message ?? 'Sesi berhasil diputus');
      else toast.error(data.reason ?? 'Gagal memutus sesi');
    },
    onError: () => toast.error('Gagal memutus sesi'),
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