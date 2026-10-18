import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

// Batas tunggu untuk login & refresh token. Tanpa batas, request yang macet
// membuat tombol Masuk berputar selamanya tanpa pesan apa pun.
export const AUTH_TIMEOUT_MS = 20_000;

// Hanya data sesi yang dihapus saat logout paksa — preferensi lain (mis. tema)
// sengaja dibiarkan.
const SESSION_KEYS = ['accessToken', 'refreshToken', 'billku-auth'];

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Tambah token ke setiap request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Endpoint auth yang responnya TIDAK boleh masuk alur "refresh token lalu redirect".
// Kalau /auth/login sendiri balas 401 (password salah), itu bukan tanda sesi
// kadaluarsa — itu error login biasa yang harus ditampilkan ke user (lihat
// useLogin.onError), bukan dianggap "sesi habis" lalu langsung reload ke /login.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout'];

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return AUTH_ENDPOINTS.some((path) => url.includes(path));
}

// Sesi memang sudah tidak sah (refresh token hilang / ditolak server) —
// berbeda dari gangguan jaringan sesaat, yang tidak boleh melempar pengguna keluar.
class SessionEndedError extends Error {}

function endSession() {
  try {
    SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // storage tidak tersedia — tidak ada yang perlu dihapus
  }
  if (window.location.pathname !== '/login') window.location.href = '/login';
}

// Satu halaman memuat beberapa request sekaligus. Saat access token habis,
// SEMUANYA mendapat 401 pada waktu yang hampir sama. Refresh token bersifat
// sekali pakai (diputar tiap refresh), jadi kalau tiap request memanggil
// /auth/refresh sendiri-sendiri, yang kedua dan seterusnya memakai token yang
// sudah terpakai dan ditolak → pengguna terlempar ke halaman login padahal
// sesinya masih sah. Karena itu semua request menunggu SATU panggilan refresh
// yang sama, lalu masing-masing mengulang requestnya dengan token baru.
let refreshInFlight: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;

  const usedRefreshToken = localStorage.getItem('refreshToken');

  refreshInFlight = (async () => {
    if (!usedRefreshToken) throw new SessionEndedError('Tidak ada refresh token');

    try {
      const { data } = await axios.post(
        `${API_URL}/auth/refresh`,
        { refreshToken: usedRefreshToken },
        { timeout: AUTH_TIMEOUT_MS },
      );
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
    } catch (err) {
      // Tab lain di browser yang sama bisa saja sudah memutar token lebih dulu.
      // Kalau refresh token di storage sudah berganti, sesinya masih sah dan
      // pasangan token barunya sudah tersimpan — tinggal dipakai.
      const current = localStorage.getItem('refreshToken');
      if (current && current !== usedRefreshToken) return;

      const status = (err as AxiosError).response?.status;
      if (status === 400 || status === 401 || status === 403) {
        throw new SessionEndedError('Refresh token ditolak server');
      }
      // Jaringan putus / timeout / server error: sesi dipertahankan, request
      // asal gagal dengan error aslinya (bukan logout paksa).
      throw err;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

// Handle 401 → refresh token
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      isAuthEndpoint(original.url)
    ) {
      return Promise.reject(error);
    }
    original._retry = true;

    // Token di storage sudah berganti sejak request ini dikirim (request lain /
    // tab lain sudah me-refresh): cukup ulangi dengan token terbaru.
    const sent = String(original.headers?.Authorization ?? '');
    const stored = localStorage.getItem('accessToken');
    if (stored && sent && sent !== `Bearer ${stored}`) {
      return api(original);
    }

    try {
      await refreshSession();
    } catch (refreshError) {
      if (refreshError instanceof SessionEndedError) endSession();
      return Promise.reject(error);
    }

    // Interceptor request di atas memasang access token terbaru dari storage.
    return api(original);
  },
);

export default api;
