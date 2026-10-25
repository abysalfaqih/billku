import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type {
  Payment, CreatePaymentResponse, PaginatedResponse,
  AdvancePlan, AdvancePaymentResult, CreateAdvancePaymentInput,
} from '@/types';

// Pesan error dari server (validasi mengembalikan array) → satu kalimat untuk ditampilkan.
export function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data?.message;
  return Array.isArray(msg) ? msg[0] : (msg ?? fallback);
}

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
      } else if (reactivation?.status === 'blocked') {
        // Pembayaran tercatat, tapi masih ada tunggakan lain → layanan belum dibuka.
        // Tanpa pemberitahuan ini admin mengira pelanggan sudah aktif.
        const rupiah = (v: string) => `Rp ${Number(v).toLocaleString('id-ID')}`;
        // 'YYYY-MM-DD' → '15 Sep 2026' tanpa melewati Date (tidak bergeser zona waktu)
        const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const tanggal = (ymd: string) => {
          const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
          return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1] ?? m[2]} ${m[1]}` : ymd;
        };
        const daftar = reactivation.remaining
          .map((r) => `${r.billNumber} (${rupiah(r.totalAmount)}, jatuh tempo ${tanggal(r.dueDate)})`)
          .join('; ');
        toast.success('Pembayaran berhasil dicatat');
        toast(
          `Pelanggan masih punya tunggakan: ${daftar}. ` +
          'Layanan baru aktif kembali setelah semuanya lunas — bayar tagihan tersebut, ' +
          'atau batalkan bila memang tidak perlu ditagih.',
          { icon: '⚠️', duration: 12000 },
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

// Pratinjau bayar di muka. Selalu diambil ulang saat dialog dibuka (tanpa cache) supaya
// yang dilihat admin sesuai kondisi tagihan saat itu.
export function useAdvancePreview(customerId: number, months: number, enabled: boolean) {
  return useQuery<AdvancePlan>({
    queryKey: ['advance-preview', customerId, months],
    queryFn: () =>
      api.get('/payments/advance/preview', { params: { customerId, months } }).then((r) => r.data),
    enabled,
    gcTime: 0,
    staleTime: 0,
    retry: false, // penolakan server (pelanggan menunggak, dll.) bukan error sementara
  });
}

export function useCreateAdvancePayment(onSuccess?: (res: AdvancePaymentResult) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAdvancePaymentInput) =>
      api.post<AdvancePaymentResult>('/payments/advance', data).then((r) => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['bill-detail'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer-detail'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onSuccess?.(res);
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, 'Gagal mencatat pembayaran di muka'));
      // Kalau gagal karena pratinjau basi, tampilkan yang terbaru.
      qc.invalidateQueries({ queryKey: ['advance-preview'] });
    },
  });
}