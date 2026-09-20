import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { SubscriptionPlan, TenantSubscriptionRow } from '@/types';

export function useSubscriptionPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: ['subscription-plans'],
    queryFn: () => api.get('/subscription-plans').then((r) => r.data),
  });
}

export function useTenantSubscriptions() {
  return useQuery<TenantSubscriptionRow[]>({
    queryKey: ['tenant-subscriptions'],
    queryFn: () => api.get('/tenant-subscriptions').then((r) => r.data),
  });
}

// Aktifkan langganan baru untuk mitra. Kalau mitra tersebut sudah punya
// langganan aktif, backend otomatis membatalkan yang lama & mencatat yang
// baru sebagai baris riwayat terpisah — inilah alur resmi untuk "ganti paket".
export function useAssignSubscription(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/tenant-subscriptions', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-subscriptions'] });
      toast.success('Langganan berhasil diaktifkan');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal mengaktifkan langganan'));
    },
  });
}

// Koreksi record langganan yang SUDAH ADA (tanpa membuat baris riwayat baru) —
// dipakai untuk memperbaiki kesalahan input seperti nominal dibayar, catatan,
// atau durasi/paket yang salah pilih.
export function useUpdateTenantSubscription(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put(`/tenant-subscriptions/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-subscriptions'] });
      toast.success('Langganan berhasil diperbarui');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal memperbarui langganan'));
    },
  });
}

export function useCreatePlan(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/subscription-plans', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast.success('Paket berhasil dibuat');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal membuat paket'));
    },
  });
}

export function useUpdatePlan(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put(`/subscription-plans/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast.success('Paket berhasil diperbarui');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal memperbarui paket'));
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/subscription-plans/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast.success('Paket dinonaktifkan');
    },
    onError: () => toast.error('Gagal menonaktifkan paket'),
  });
}
