import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Pengganti ringan untuk paket `next-themes` (dipakai di versi Next.js sebelumnya).
 * Perilakunya disamakan persis dengan konfigurasi lama:
 *  - attribute "class": theme aktif diterapkan sebagai class "light"/"dark" di <html>
 *  - defaultTheme "light": dipakai kalau belum ada preferensi tersimpan
 *  - storageKey "billku-theme": key localStorage tempat preferensi disimpan
 * Tidak ada deteksi preferensi sistem (prefers-color-scheme) karena konfigurasi
 * lama juga tidak pernah memicu jalur "system" — theme-toggle selalu men-set
 * 'light' atau 'dark' secara eksplisit.
 */
export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = 'theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    const stored = window.localStorage.getItem(storageKey);
    return stored === 'light' || stored === 'dark' ? stored : defaultTheme;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // localStorage tidak tersedia (mis. private mode) — tetap lanjut ganti theme di memori
    }
    setThemeState(next);
  }, [storageKey]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
