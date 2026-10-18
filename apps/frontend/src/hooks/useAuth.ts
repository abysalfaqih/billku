import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { AUTH_TIMEOUT_MS } from '@/lib/api';
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
      api.post('/auth/login', dto, { timeout: AUTH_TIMEOUT_MS }).then((r) => r.data),

    onSuccess: (data) => {
      queryClient.clear(); // buang cache sesi/tenant sebelumnya
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`Selamat datang, ${data.user.email}`);
      navigate('/dashboard');
    },

    onError: (error: any) => {
      // Tidak ada respons dari server: tombol Masuk tidak boleh berputar tanpa
      // penjelasan — bedakan "server tidak menjawab" dari "password salah".
      if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
        toast.error('Server tidak merespons. Periksa koneksi internet, lalu coba lagi.');
        return;
      }
      if (!error?.response) {
        toast.error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
        return;
      }
      const msg = error.response.data?.message;
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