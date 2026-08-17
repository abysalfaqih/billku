import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Menu, LogOut, Users, ChevronRight, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useSidebar } from '@/lib/sidebar-context';
import { useAuthStore } from '@/stores/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';

// ─── Status ──────────────────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  active: '#10B981', isolated: '#EF4444',
  suspended: '#F59E0B', terminated: '#9CA3AF',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif', isolated: 'Isolir',
  suspended: 'Ditangguhkan', terminated: 'Berhenti',
};

// ─── User Dropdown ────────────────────────────────────────────────────────────
function UserMenu() {
  const { user } = useAuthStore();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: 'white',
          background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
          border: 'none', cursor: 'pointer',
        }}
      >
        {user?.email?.[0]?.toUpperCase()}
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top: 54,
          right: 16,
          zIndex: 200,
          width: 220,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <p style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text-1)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user?.email}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, textTransform: 'capitalize' }}>
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
          <div style={{ padding: 6 }}>
            <button
              onClick={() => { setOpen(false); logout(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'none', fontSize: 13, color: 'var(--text-2)',
                textAlign: 'left', fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--nav-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              <LogOut size={14} /> Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Global Search ────────────────────────────────────────────────────────────
interface SearchResult {
  id: number;
  name: string;
  phone: string;
  status: string;
  areaName?: string | null;
}

function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/customers', { params: { search: q, limit: 7 } });
      const rows: SearchResult[] = data.data ?? [];
      setResults(rows);
      setOpen(true);
      setSelectedIdx(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce ketika query berubah
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query), 280);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  // Tutup saat klik di luar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const navigateTo = (c: SearchResult) => {
    navigate(`/customers?search=${encodeURIComponent(c.name)}`);
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  const showAll = () => {
    if (!query.trim()) return;
    navigate(`/customers?search=${encodeURIComponent(query)}`);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((p) => Math.min(p + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((p) => Math.max(p - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIdx >= 0 && results[selectedIdx]) {
        navigateTo(results[selectedIdx]);
      } else {
        showAll();
      }
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} style={{ flex: 1, maxWidth: 480, position: 'relative' }}>
      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', height: 36,
        background: 'var(--input-bg)',
        border: '1.5px solid var(--input-border)',
        borderRadius: 10, transition: 'border-color 0.15s',
      }}>
        <Search size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />

        <input
          ref={inputRef}
          type="text"
          placeholder="Cari pelanggan... (⌘K)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 13, color: 'var(--text-1)', fontFamily: 'inherit',
          }}
        />

        {loading && (
          <div style={{
            width: 14, height: 14, border: '2px solid var(--border)',
            borderTopColor: '#4F46E5', borderRadius: '50%',
            animation: 'tnSpin 0.6s linear infinite', flexShrink: 0,
          }} />
        )}

        {query && !loading && (
          <button
            onClick={clearSearch}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-3)', padding: 0, display: 'flex',
              alignItems: 'center', flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}>
          {/* Header */}
          <div style={{
            padding: '8px 12px 6px', display: 'flex', alignItems: 'center', gap: 6,
            borderBottom: '1px solid var(--border)',
          }}>
            <Users size={11} style={{ color: 'var(--text-3)' }} />
            <p style={{
              fontSize: 10, color: 'var(--text-3)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              Pelanggan
            </p>
          </div>

          {/* Hasil */}
          {results.map((c, i) => {
            const isSelected = selectedIdx === i;
            return (
              <button
                key={c.id}
                onClick={() => navigateTo(c)}
                onMouseEnter={() => setSelectedIdx(i)}
                onMouseLeave={() => setSelectedIdx(-1)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', border: 'none', cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'inherit',
                  background: isSelected ? 'var(--nav-active-bg)' : 'transparent',
                  transition: 'background 0.1s',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: 'white',
                }}>
                  {c.name[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text-1)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {c.name}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {c.phone}
                    {c.areaName ? ` · ${c.areaName}` : ''}
                  </p>
                </div>

                {/* Status */}
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: STATUS_DOT[c.status] ?? '#9CA3AF',
                  flexShrink: 0,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: STATUS_DOT[c.status] ?? '#9CA3AF',
                  }} />
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </button>
            );
          })}

          {/* Lihat semua */}
          <button
            onClick={showAll}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', border: 'none', cursor: 'pointer',
              background: 'var(--surface-2)', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--nav-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
          >
            <p style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
              Lihat semua hasil untuk "<strong style={{ color: 'var(--text-1)' }}>{query}</strong>"
            </p>
            <ChevronRight size={13} style={{ color: 'var(--text-3)' }} />
          </button>
        </div>
      )}

      {/* Tidak ada hasil */}
      {open && !loading && query.length >= 2 && results.length === 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '20px 16px', textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Tidak ada pelanggan dengan nama "<strong>{query}</strong>"
          </p>
        </div>
      )}

      <style>{`@keyframes tnSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── TopNav ───────────────────────────────────────────────────────────────────
export function TopNav() {
  const { toggle } = useSidebar();

  return (
    <header style={{
      height: 54, flexShrink: 0, display: 'flex', alignItems: 'center',
      gap: 12, padding: '0 16px', zIndex: 30,
      background: 'var(--topbar-bg)',
      borderBottom: '1px solid var(--topbar-border)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }}>
      <button
        onClick={toggle}
        className="md:hidden"
        style={{
          width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)',
          background: 'var(--surface-2)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)', flexShrink: 0,
        }}
      >
        <Menu size={16} />
      </button>

      <GlobalSearch />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <ThemeToggle size="sm" />
        <UserMenu />
      </div>
    </header>
  );
}