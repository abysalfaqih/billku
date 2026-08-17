import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { WhatsappConfig } from '@/types';

export function useWhatsappConfigs() {
  return useQuery<WhatsappConfig[]>({
    queryKey: ['whatsapp-configs'],
    queryFn: () => api.get('/whatsapp-configs').then((r) => r.data),
  });
}

export function useCreateWhatsappConfig(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/whatsapp-configs', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-configs'] });
      toast.success('Konfigurasi WhatsApp berhasil ditambahkan');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal menambah konfigurasi'));
    },
  });
}

export function useTestWhatsapp() {
  return useMutation({
    mutationFn: (id: number) => api.post(`/whatsapp-configs/${id}/test`).then((r) => r.data),
    onSuccess: (data) => toast.success(data.message),
    onError: () => toast.error('Gagal mengirim pesan test'),
  });
}

export function useDeleteWhatsappConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/whatsapp-configs/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-configs'] });
      toast.success('Konfigurasi berhasil dihapus');
    },
    onError: () => toast.error('Gagal menghapus konfigurasi'),
  });
}