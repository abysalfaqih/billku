import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Menu, LogOut, Users, FileText, ChevronRight, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useSidebar } from '@/lib/sidebar-context';
import { useAuthStore } from '@/stores/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import type { Bill, Customer, PaginatedResponse } from '@/types';

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
// Mencari pelanggan (nama / No. HP / email / kode pelanggan / username) dan
// tagihan (No. Tagihan / nama / No. HP / kode pelanggan). Memilih hasil
// langsung membuka halaman detailnya:
//   Pelanggan → /customers/:id
//   Tagihan   → /customers/:id?tab=tagihan&bill=:billId
//               (belum ada halaman detail tagihan tersendiri, jadi dibuka di tab
//               Tagihan milik pelanggannya dan tagihan itu otomatis terbuka)
const SEARCH_LIMIT = 5;

const BILL_STATUS: Record<string, { label: string; color: string }> = {
  unpaid:    { label: 'Belum Bayar', color: '#F59E0B' },
  paid:      { label: 'Lunas',       color: '#10B981' },
  overdue:   { label: 'Jatuh Tempo', color: '#EF4444' },
  cancelled: { label: 'Dibatalkan',  color: '#9CA3AF' },
};

type SearchItem =
  | { kind: 'customer'; key: string; to: string; data: Customer }
  | { kind: 'bill'; key: string; to: string; data: Bill };

function formatRp(v: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(v));
}

function GroupHeader({ icon: Icon, label, first }: { icon: React.ElementType; label: string; first?: boolean }) {
  return (
    <div style={{
      padding: '8px 12px 6px', display: 'flex', alignItems: 'center', gap: 6,
      borderBottom: '1px solid var(--border)',
      borderTop: first ? 'none' : '1px solid var(--border)',
      background: 'var(--surface-2)',
    }}>
      <Icon size={11} style={{ color: 'var(--text-3)' }} />
      <p style={{
        fontSize: 10, color: 'var(--text-3)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.07em',
      }}>
        {label}
      </p>
    </div>
  );
}

function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  // Kata kunci yang menghasilkan `items` saat ini — dipakai untuk mengenali hasil basi
  const [resultsFor, setResultsFor] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Naik setiap ada pencarian baru → respons pencarian lama yang telat datang diabaikan
  const requestId = useRef(0);

  const resetSearch = useCallback(() => {
    requestId.current++;
    setQuery('');
    setItems([]);
    setResultsFor('');
    setOpen(false);
    setLoading(false);
  }, []);

  const goTo = useCallback((item: SearchItem) => {
    navigate(item.to);
    resetSearch();
    inputRef.current?.blur();
  }, [navigate, resetSearch]);

  const doSearch = useCallback(async (q: string, openFirst = false) => {
    const keyword = q.trim();
    const id = ++requestId.current;
    if (keyword.length < 2) {
      setItems([]);
      setResultsFor('');
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Dua pencarian berjalan paralel; kalau salah satu gagal, yang lain tetap tampil.
    const [cust, bill] = await Promise.allSettled([
      api.get<PaginatedResponse<Customer>>('/customers', { params: { search: keyword, limit: SEARCH_LIMIT } }),
      api.get<PaginatedResponse<Bill>>('/billing', { params: { search: keyword, limit: SEARCH_LIMIT } }),
    ]);
    if (id !== requestId.current) return; // sudah ada pencarian yang lebih baru

    const customerRows = cust.status === 'fulfilled' ? cust.value.data.data ?? [] : [];
    const billRows = bill.status === 'fulfilled' ? bill.value.data.data ?? [] : [];

    const next: SearchItem[] = [
      ...customerRows.map((c): SearchItem => ({
        kind: 'customer', key: `c-${c.id}`, to: `/customers/${c.id}`, data: c,
      })),
      ...billRows.map((b): SearchItem => ({
        kind: 'bill', key: `b-${b.id}`,
        to: `/customers/${b.customerId}?tab=tagihan&bill=${b.id}`, data: b,
      })),
    ];

    setItems(next);
    setCustomerTotal(cust.status === 'fulfilled' ? cust.value.data.meta?.total ?? customerRows.length : 0);
    setResultsFor(keyword);
    setSelectedIdx(-1);
    setLoading(false);

    if (openFirst && next[0]) {
      goTo(next[0]);
      return;
    }
    setOpen(true);
  }, [goTo]);

  // Debounce ketika query berubah
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      requestId.current++;
      setItems([]);
      setResultsFor('');
      setOpen(false);
      setLoading(false);
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
        resetSearch();
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [resetSearch]);

  const showAllCustomers = () => {
    const keyword = query.trim();
    if (!keyword) return;
    navigate(`/customers?search=${encodeURIComponent(keyword)}`);
    resetSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((p) => Math.min(p + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((p) => Math.max(p - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const keyword = query.trim();
      if (keyword.length < 2) return;

      if (resultsFor === keyword) {
        // Hasil sudah sesuai kata kunci: buka yang disorot, atau hasil teratas
        const target = selectedIdx >= 0 ? items[selectedIdx] : items[0];
        if (target) goTo(target);
      } else {
        // Hasil belum ada / basi (Enter ditekan sebelum debounce selesai):
        // cari sekarang juga, lalu langsung buka hasil teratasnya.
        clearTimeout(debounceRef.current);
        doSearch(keyword, true);
      }
    }
  };

  const clearSearch = () => {
    resetSearch();
    inputRef.current?.focus();
  };

  const customerItems = items.filter((i) => i.kind === 'customer');
  const billItems = items.filter((i) => i.kind === 'bill');
  const hasMoreCustomers = customerTotal > customerItems.length;
  const dropdownStyle: React.CSSProperties = {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
    zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  };

  const renderRow = (item: SearchItem) => {
    const i = items.indexOf(item);
    const isSelected = selectedIdx === i;
    const rowStyle: React.CSSProperties = {
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', border: 'none', cursor: 'pointer',
      textAlign: 'left', fontFamily: 'inherit',
      background: isSelected ? 'var(--nav-active-bg)' : 'transparent',
      transition: 'background 0.1s',
      borderBottom: '1px solid var(--border)',
    };

    if (item.kind === 'customer') {
      const c = item.data;
      return (
        <button
          key={item.key}
          onClick={() => goTo(item)}
          onMouseEnter={() => setSelectedIdx(i)}
          onMouseLeave={() => setSelectedIdx(-1)}
          style={rowStyle}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'white',
          }}>
            {c.name[0]?.toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text-1)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {c.name}
            </p>
            <p style={{
              fontSize: 11, color: 'var(--text-3)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {c.phone}
              {c.areaName ? ` · ${c.areaName}` : ''}
            </p>
          </div>

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
    }

    const b = item.data;
    const st = BILL_STATUS[b.status] ?? { label: b.status, color: '#9CA3AF' };
    return (
      <button
        key={item.key}
        onClick={() => goTo(item)}
        onMouseEnter={() => setSelectedIdx(i)}
        onMouseLeave={() => setSelectedIdx(-1)}
        style={rowStyle}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'var(--nav-active-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FileText size={15} style={{ color: 'var(--nav-active-icon)' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-1)', fontFamily: 'monospace',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {b.billNumber}
          </p>
          <p style={{
            fontSize: 11, color: 'var(--text-3)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {b.customerName ?? '—'} · {b.packageName}
          </p>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
            {formatRp(b.totalAmount)}
          </p>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: st.color,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color }} />
            {st.label}
          </span>
        </div>
      </button>
    );
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
          placeholder="Cari pelanggan atau tagihan... (⌘K)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (items.length > 0) setOpen(true); }}
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
      {open && items.length > 0 && (
        <div style={dropdownStyle}>
          {customerItems.length > 0 && (
            <>
              <GroupHeader icon={Users} label="Pelanggan" first />
              {customerItems.map(renderRow)}
            </>
          )}

          {billItems.length > 0 && (
            <>
              <GroupHeader icon={FileText} label="Tagihan" first={customerItems.length === 0} />
              {billItems.map(renderRow)}
            </>
          )}

          {/* Lihat semua (hanya kalau pelanggan yang cocok lebih banyak dari yang ditampilkan) */}
          {hasMoreCustomers && (
            <button
              onClick={showAllCustomers}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', border: 'none', cursor: 'pointer',
                background: 'var(--surface-2)', fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--nav-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
            >
              <p style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                Lihat semua {customerTotal} pelanggan untuk "<strong style={{ color: 'var(--text-1)' }}>{query.trim()}</strong>"
              </p>
              <ChevronRight size={13} style={{ color: 'var(--text-3)' }} />
            </button>
          )}
        </div>
      )}

      {/* Tidak ada hasil */}
      {open && !loading && query.trim().length >= 2 && items.length === 0 && (
        <div style={{
          ...dropdownStyle, padding: '20px 16px', textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Tidak ada pelanggan atau tagihan untuk "<strong>{query.trim()}</strong>"
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