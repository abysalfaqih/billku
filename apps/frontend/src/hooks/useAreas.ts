import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { Area } from '@/types';

export function useAreas() {
  return useQuery<Area[]>({
    queryKey: ['areas'],
    queryFn: () => api.get('/areas').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useCreateArea(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post('/areas', { name }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['areas'] });
      toast.success('Area berhasil ditambahkan');
      onSuccess?.();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Gagal menambah area'),
  });
}

export function useDeleteArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/areas/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['areas'] });
      toast.success('Area berhasil dihapus');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Gagal menghapus area'),
  });
}