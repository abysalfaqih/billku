import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { Payment, CreatePaymentResponse, PaginatedResponse } from '@/types';

interface PaymentParams {
  page?: number;
  limit?: number;
  customerId?: number;
  search?: string;
}

export function usePayments(params: PaymentParams) {
  return useQuery<PaginatedResponse<Payment>>({
    queryKey: ['payments', params],
    queryFn: () => api.get('/payments', { params }).then((r) => r.data),
  });
}

export function useCreatePayment(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { billId: number; paymentMethod: string; notes?: string }) =>
      api.post<CreatePaymentResponse>('/payments', data).then((r) => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['bill-detail'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer-detail'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });

      const reactivation = res.reactivation;
      if (reactivation?.status === 'failed') {
        // Pembayaran tercatat, tapi koneksi pelanggan belum bisa dipulihkan —
        // status pelanggan sengaja dibiarkan Isolir supaya tidak menyesatkan.
        toast.success('Pembayaran berhasil dicatat');
        toast(
          `Koneksi pelanggan belum bisa diaktifkan kembali (${reactivation.message}). ` +
          'Status pelanggan tetap Isolir — coba lagi lewat Edit Pelanggan → Status → Aktif.',
          { icon: '⚠️', duration: 10000 },
        );
      } else if (reactivation?.status === 'reactivated') {
        toast.success('Pembayaran dicatat — pelanggan diaktifkan kembali');
      } else {
        toast.success('Pembayaran berhasil dicatat');
      }
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal mencatat pembayaran'));
    },
  });
}