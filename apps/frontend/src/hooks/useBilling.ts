import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { Bill, BillDetail, PaginatedResponse } from '@/types';

interface BillParams {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: number;
  search?: string;
}

export function useBills(params: BillParams) {
  return useQuery<PaginatedResponse<Bill>>({
    queryKey: ['bills', params],
    queryFn: () => api.get('/billing', { params }).then((r) => r.data),
  });
}

export function useBillDetail(id: number | undefined) {
  return useQuery<BillDetail>({
    queryKey: ['bill-detail', id],
    queryFn: () => api.get(`/billing/${id}/detail`).then((r) => r.data),
    enabled: !!id,
    retry: (count, err: any) => err?.response?.status !== 404 && count < 2,
  });
}

// Buka invoice PDF di tab baru (dipakai halaman Tagihan & detail tagihan)
export async function openInvoicePdf(billId: number) {
  try {
    const res = await api.get(`/billing/${billId}/invoice`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
  } catch {
    toast.error('Gagal membuka invoice');
  }
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
      qc.invalidateQueries({ queryKey: ['bill-detail'] });
      toast.success('Tagihan dibatalkan');
    },
    onError: () => toast.error('Gagal membatalkan tagihan'),
  });
}