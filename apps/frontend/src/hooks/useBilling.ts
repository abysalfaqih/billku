import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { Bill, PaginatedResponse } from '@/types';

interface BillParams {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: number;
}

export function useBills(params: BillParams) {
  return useQuery<PaginatedResponse<Bill>>({
    queryKey: ['bills', params],
    queryFn: () => api.get('/billing', { params }).then((r) => r.data),
  });
}

export function useGenerateBill(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (customerId: number) =>
      api.post(`/billing/generate/${customerId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Tagihan berhasil dibuat');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal generate tagihan'));
    },
  });
}

export function useCancelBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.put(`/billing/${id}/cancel`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Tagihan dibatalkan');
    },
    onError: () => toast.error('Gagal membatalkan tagihan'),
  });
}