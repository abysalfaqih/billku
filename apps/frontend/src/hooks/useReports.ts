import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function useRevenueReport(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['reports', 'revenue', startDate, endDate],
    queryFn: () => api.get('/reports/revenue', { params: { startDate, endDate } }).then((r) => r.data),
  });
}

export function useBillsReport() {
  return useQuery({
    queryKey: ['reports', 'bills'],
    queryFn: () => api.get('/reports/bills').then((r) => r.data),
  });
}

export function useCustomersReport() {
  return useQuery({
    queryKey: ['reports', 'customers'],
    queryFn: () => api.get('/reports/customers').then((r) => r.data),
  });
}