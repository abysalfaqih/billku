import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { Package } from '@/types';

export function usePackages() {
  return useQuery<Package[]>({
    queryKey: ['packages'],
    queryFn: () => api.get('/packages').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useCreatePackage(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/packages', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      toast.success('Paket berhasil ditambahkan');
      onSuccess?.();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Gagal menambah paket'),
  });
}

export function useUpdatePackage(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put(`/packages/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      toast.success('Paket berhasil diperbarui');
      onSuccess?.();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Gagal memperbarui'),
  });
}

export function useDeletePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/packages/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      toast.success('Paket berhasil dinonaktifkan');
    },
    onError: () => toast.error('Gagal menghapus paket'),
  });
}