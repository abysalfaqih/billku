import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { IpPool } from '@/types';

export function useIpPools() {
  return useQuery<IpPool[]>({
    queryKey: ['ip-pools'],
    queryFn: () => api.get('/ip-pools').then((r) => r.data),
  });
}

export function useCreateIpPool(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/ip-pools', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ip-pools'] });
      toast.success('IP Pool berhasil dibuat & disinkronkan ke Mikrotik');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal membuat IP Pool'));
    },
  });
}

export function useDeleteIpPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/ip-pools/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ip-pools'] });
      toast.success('IP Pool berhasil dihapus');
    },
    onError: () => toast.error('Gagal menghapus IP Pool'),
  });
}