import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface LoginDto {
  tenantSlug: string;
  email: string;
  password: string;
}

export function useLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setAuth } = useAuthStore();

  return useMutation({
    mutationFn: (dto: LoginDto) =>
      api.post('/auth/login', dto).then((r) => r.data),

    onSuccess: (data) => {
      queryClient.clear(); // buang cache sesi/tenant sebelumnya
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`Selamat datang, ${data.user.email}`);
      navigate('/dashboard');
    },

    onError: (error: any) => {
      const msg = error?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Login gagal'));
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clearAuth } = useAuthStore();

  return () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    clearAuth();
    queryClient.clear(); // reset cache biar tenant berikutnya gak kebawa data lama
    toast.success('Logout berhasil');
    navigate('/login', { replace: true });
  };
}