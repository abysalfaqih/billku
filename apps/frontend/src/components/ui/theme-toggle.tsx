import { useTheme } from '@/lib/theme-provider';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return (
    <div style={{ width: size === 'sm' ? 30 : 34, height: size === 'sm' ? 30 : 34 }} />
  );

  const isDark = resolvedTheme === 'dark';
  const sz = size === 'sm' ? 14 : 16;
  const dim = size === 'sm' ? 30 : 34;

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      style={{
        width: dim, height: dim, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', border: '1px solid var(--border)',
        background: 'var(--surface-2)', color: 'var(--text-2)',
        transition: 'all 0.2s',
      }}
      title={isDark ? 'Mode Terang' : 'Mode Gelap'}
    >
      {isDark ? <Sun size={sz} /> : <Moon size={sz} />}
    </button>
  );
}