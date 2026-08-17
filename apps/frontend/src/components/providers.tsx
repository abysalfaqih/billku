import { ThemeProvider } from '@/lib/theme-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { ChunkErrorReload } from '@/components/chunk-error-reload';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    },
  }));

  return (
    <ThemeProvider
      defaultTheme="light"
      storageKey="billku-theme"
    >
      <QueryClientProvider client={queryClient}>
        <ChunkErrorReload />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              fontSize: '13px', borderRadius: '12px',
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}