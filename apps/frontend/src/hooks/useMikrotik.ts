import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { MikrotikConfig } from '@/types';

export function useMikrotikConfigs() {
  return useQuery<MikrotikConfig[]>({
    queryKey: ['mikrotik-configs'],
    queryFn: () => api.get('/mikrotik-configs').then((r) => r.data),
    staleTime: 60_000,
  });
}
export function useCreateMikrotik(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/mikrotik-configs', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mikrotik-configs'] });
      toast.success('Mikrotik berhasil ditambahkan');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal menambah Mikrotik'));
    },
  });
}

export function useUpdateMikrotik(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put(`/mikrotik-configs/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mikrotik-configs'] });
      toast.success('Mikrotik berhasil diperbarui');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal memperbarui Mikrotik'));
    },
  });
}

export function useTestMikrotik() {
  return useMutation({
    mutationFn: (id: number) => api.post(`/mikrotik-configs/${id}/test`).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: () => toast.error('Gagal terhubung ke Mikrotik'),
  });
}

export function useDeleteMikrotik() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/mikrotik-configs/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mikrotik-configs'] });
      toast.success('Mikrotik berhasil dihapus');
    },
    onError: () => toast.error('Gagal menghapus Mikrotik'),
  });
}

export function useHotspotProfiles(mikrotikId: number | null) {
  return useQuery<string[]>({
    queryKey: ['hotspot-profiles', mikrotikId],
    queryFn: () =>
      api.get(`/mikrotik-configs/${mikrotikId}/hotspot-profiles`).then((r) => r.data),
    enabled: !!mikrotikId,
    staleTime: 30_000,
    retry: false,
  });
}