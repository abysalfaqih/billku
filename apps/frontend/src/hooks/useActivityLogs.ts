import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ActivityLog, PaginatedResponse } from '@/types';

interface LogParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export function useActivityLogs(params: LogParams) {
  return useQuery<PaginatedResponse<ActivityLog>>({
    queryKey: ['activity-logs', params],
    queryFn: () => api.get('/activity-logs', { params }).then((r) => r.data),
  });
}