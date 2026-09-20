import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { Tenant } from '@/types';

export function useTenants() {
  return useQuery<Tenant[]>({
    queryKey: ['tenants'],
    queryFn: () => api.get('/tenants').then((r) => r.data),
  });
}

export function useCreateTenant(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/tenants', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['tenant-subscriptions'] });
      toast.success('Mitra berhasil ditambahkan');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal menambah mitra'));
    },
  });
}

export function useUpdateTenant(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put(`/tenants/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['tenant-subscriptions'] });
      qc.invalidateQueries({ queryKey: ['tenant-invoices'] });
      toast.success('Mitra berhasil diperbarui');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal memperbarui mitra'));
    },
  });
}

export function useToggleTenantActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/tenants/${id}/toggle-active`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Status mitra diperbarui');
    },
    onError: () => toast.error('Gagal mengubah status'),
  });
}

// Hapus mitra secara permanen. Backend akan ikut membersihkan SELURUH data
// turunannya (pengguna, pelanggan, tagihan, invoice, langganan, dst) dalam
// satu transaksi, jadi kita invalidate semua query terkait supaya UI lain
// (pengguna, invoice mitra, langganan mitra) langsung ikut ter-refresh.
export function useDeleteTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tenants/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['tenant-subscriptions'] });
      qc.invalidateQueries({ queryKey: ['tenant-invoices'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Mitra beserta seluruh data terkait berhasil dihapus');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal menghapus mitra'));
    },
  });
}
