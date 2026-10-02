import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'staff';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function useUsers(tenantId?: string) {
  return useQuery<UserRow[]>({
    queryKey: ['users', tenantId],
    queryFn: () => api.get('/users', { params: tenantId ? { tenantId } : {} }).then((r) => r.data),
  });
}

export function useCreateUser(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/users', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Pengguna berhasil ditambahkan');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal menambah pengguna'));
    },
  });
}

export function useUpdateUser(tenantId: string | undefined, onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put(`/users/${id}`, data, { params: tenantId ? { tenantId } : {} }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Pengguna berhasil diperbarui');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal memperbarui pengguna'));
    },
  });
}

export function useDeleteUser(tenantId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/users/${id}`, { params: tenantId ? { tenantId } : {} }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Pengguna berhasil dihapus');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal menghapus pengguna'));
    },
  });
}

export function useToggleUserActive(tenantId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.put(`/users/${id}/toggle-active`, undefined, { params: tenantId ? { tenantId } : {} }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Status pengguna diperbarui');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      // FIX: sebelumnya pesan asli dari backend dibuang kalau bukan array
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal mengubah status'));
    },
  });
}