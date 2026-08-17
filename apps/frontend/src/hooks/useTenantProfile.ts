import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { TenantProfile } from '@/types';

export function useTenantProfile() {
  return useQuery<TenantProfile>({
    queryKey: ['tenant-profile'],
    queryFn: () => api.get('/tenants/me/profile').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useUpdateTenantProfile(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put('/tenants/me/profile', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-profile'] });
      toast.success('Profil perusahaan berhasil disimpan');
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal menyimpan profil'));
    },
  });
}

export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      api.post('/tenants/me/profile/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-profile'] });
      toast.success('Logo berhasil diunggah');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Gagal mengunggah logo'),
  });
}

export function useUploadFavicon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      api.post('/tenants/me/profile/favicon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-profile'] });
      toast.success('Favicon berhasil diunggah');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Gagal mengunggah favicon'),
  });
}