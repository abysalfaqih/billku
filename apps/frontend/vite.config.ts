import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Di luar folder apps/frontend dengan sengaja — supaya aman kalau
    // workflow deploy kamu "hapus semua isi apps/frontend lalu extract
    // ulang". Lihat deploy-frontend.sh untuk detail lengkapnya.
    outDir: '../frontend-build',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});
