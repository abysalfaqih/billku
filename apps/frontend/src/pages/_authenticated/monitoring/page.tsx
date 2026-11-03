import { useState, useEffect, useRef } from 'react';
import { Search, WifiOff, Power, RefreshCw, ArrowLeft, Ban, SearchX, CloudOff, CircleHelp, DatabaseZap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { fetchCustomerSession, useKickSession, useSyncHotspot, SEARCH_TIMEOUT_MS } from '@/hooks/useMonitoring';
import type { SessionResponse, SessionState } from '@/hooks/useMonitoring';
import api from '@/lib/api';
import { SessionInfoCard } from './components/session-info-card';
import { TrafficPanel } from './components/traffic-card';
import { INITIAL_VIEW, SESSION_POLL_MS, applyResult, lookOf, requestFailed } from './components/session-state';
import type { ViewState } from './components/session-state';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SearchResult {
  id: number;
  name: string;
  phone: string;
  usernamePppoe: string | null;
  connectionType: 'pppoe' | 'hotspot';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: 'pppoe' | 'hotspot' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
      padding: '2px 8px', borderRadius: 99,
      background: type === 'hotspot' ? 'rgba(245,158,11,0.1)' : 'rgba(79,70,229,0.1)',
      color: type === 'hotspot' ? '#B45309' : '#4338CA',
      border: `1px solid ${type === 'hotspot' ? 'rgba(245,158,11,0.25)' : 'rgba(79,70,229,0.25)'}`,
    }}>
      {type === 'hotspot' ? '📡 Hotspot' : '🔌 PPPoE'}
    </span>
  );
}

// ─── Search Panel ─────────────────────────────────────────────────────────────
function SearchPanel({ onSelect }: { onSelect: (c: SearchResult) => void }) {
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed]   = useState(false);

  useEffect(() => {
    setFailed(false);
    if (query.length < 2) { setResults([]); return; }
    let stale = false; // abaikan jawaban lama bila pengguna sudah mengetik lagi
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/monitoring/search', { params: { q: query }, timeout: SEARCH_TIMEOUT_MS });
        if (!stale) setResults(data);
      } catch {
        // Tanpa ini kegagalan jaringan tampil sebagai "Pelanggan tidak ditemukan".
        if (!stale) { setResults([]); setFailed(true); }
      } finally {
        if (!stale) setLoading(false);
      }
    }, 300);
    return () => { stale = true; clearTimeout(t); };
  }, [query]);

  return (
    <div style={{ maxWidth: 540, width: '100%', margin: '0 auto' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        borderRadius: 12, background: 'var(--input-bg)', border: '1.5px solid var(--input-border)',
      }}>
        <Search size={16} style={{ color: 'var(--text-3)' }} />
        <input
          autoFocus placeholder="Ketik nama, username / kode voucher, atau no. HP..."
          value={query} onChange={e => setQuery(e.target.value)}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 14, color: 'var(--text-1)', fontFamily: 'inherit',
          }}
        />
        {loading && (
          <RefreshCw size={14} style={{ color: 'var(--text-3)', animation: 'monSpin 0.7s linear infinite' }} />
        )}
      </div>

      {query.length >= 2 && results.length > 0 && (
        <div style={{
          marginTop: 8, background: 'var(--surface)', borderRadius: 12,
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          {results.map(c => (
            <button
              key={c.id}
              onClick={() => { onSelect(c); setQuery(''); setResults([]); }}
              disabled={!c.usernamePppoe}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', border: 'none', background: 'none',
                cursor: c.usernamePppoe ? 'pointer' : 'not-allowed',
                borderBottom: '1px solid var(--border)', textAlign: 'left',
                opacity: c.usernamePppoe ? 1 : 0.5,
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: 'white',
              }}>
                {c.name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>
                  {c.name}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {c.usernamePppoe ?? 'Belum punya akun'} · {c.phone}
                </p>
              </div>
              <TypeBadge type={c.connectionType} />
            </button>
          ))}
        </div>
      )}

      {query.length >= 2 && !loading && results.length === 0 && (
        <div
          role={failed ? 'alert' : undefined}
          style={{
            marginTop: 8, padding: 20, textAlign: 'center', background: 'var(--surface)',
            borderRadius: 12, border: '1px solid var(--border)',
          }}
        >
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            {failed ? 'Gagal mencari pelanggan. Periksa koneksi Anda, lalu ketik ulang.' : 'Pelanggan tidak ditemukan'}
          </p>
        </div>
      )}

      <style>{`@keyframes monSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Petunjuk: pelanggan belum punya router, dicek di satu-satunya router hotspot ──
function AssumedRouterHint({ data }: { data: SessionResponse }) {
  if (!data.assumedRouter) return null;
  return (
    <p
      data-testid="assumed-router-hint"
      style={{
        marginTop: 12, padding: '8px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5, textAlign: 'center',
        color: 'var(--text-2)', background: 'rgba(79,70,229,0.07)', border: '1px solid rgba(79,70,229,0.20)',
      }}
    >
      Pelanggan ini belum memilih router, jadi dicek di satu-satunya router Hotspot
      {data.mikrotikName ? ` (${data.mikrotikName})` : ''}. Pilih router di Edit Pelanggan agar tombol
      Sinkronkan dan Putus Koneksi aktif.
    </p>
  );
}

// ─── Notice (semua keadaan selain Online) ───────────────────────────────────
const NOTICE_ICON: Record<Exclude<SessionState, 'online'>, LucideIcon> = {
  offline: WifiOff,
  disabled: Ban,
  missing: SearchX,
  unreachable: CloudOff,
  unconfigured: CircleHelp,
};

function Notice({
  data, onRetry, retrying, onSync, syncing,
}: {
  data: SessionResponse;
  onRetry: () => void;
  retrying: boolean;
  onSync: () => void;
  syncing: boolean;
}) {
  if (data.state === 'online') return null;
  const look = lookOf(data.state, data.connectionType);
  const Icon = NOTICE_ICON[data.state];
  const isolated = data.state === 'disabled' && data.customerStatus === 'isolated';

  return (
    <div
      role={data.state === 'unreachable' ? 'alert' : 'status'}
      data-testid="session-notice"
      data-state={data.state}
      style={{
        padding: '28px 20px', textAlign: 'center', background: 'var(--surface)',
        borderRadius: 14, border: '1px solid var(--border)',
      }}
    >
      <Icon size={28} aria-hidden="true" style={{ color: look.color, margin: '0 auto 10px' }} />
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>{look.label}</p>
      {data.reason && <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{data.reason}</p>}
      {isolated && (
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
          Pelanggan berstatus isolir (tagihan belum lunas). Akun aktif lagi setelah tagihannya lunas.
        </p>
      )}
      {data.mikrotikName && (
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>Mikrotik: {data.mikrotikName}</p>
      )}
      <AssumedRouterHint data={data} />

      {data.state === 'missing' && data.canSync && (
        <button
          onClick={onSync}
          disabled={syncing}
          style={{
            marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px',
            borderRadius: 9, border: 'none', background: '#4F46E5', color: '#fff', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.6 : 1,
          }}
        >
          <DatabaseZap size={14} aria-hidden="true" /> {syncing ? 'Menyinkronkan...' : 'Sinkronkan ke router'}
        </button>
      )}
      {data.state === 'unreachable' && (
        <button
          onClick={onRetry}
          disabled={retrying}
          style={{
            marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px',
            borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: retrying ? 'not-allowed' : 'pointer',
            opacity: retrying ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} aria-hidden="true" style={retrying ? { animation: 'monSpin 0.7s linear infinite' } : undefined} />
          Coba lagi
        </button>
      )}
    </div>
  );
}

// ─── Session Panel (PPPoE + Hotspot) ─────────────────────────────────────────
function SessionPanel({ customer, onBack }: { customer: SearchResult; onBack: () => void }) {
  const kick = useKickSession();

  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [refreshing, setRefreshing] = useState(false);
  // dipanggil dari tombol Muat ulang / Coba lagi / setelah sinkron; diisi oleh effect di bawah
  const runCheck = useRef<(manual: boolean) => void>(() => undefined);
  const sync = useSyncHotspot(() => runCheck.current(true));

  // Cek sesi pertama kali, lalu tiap SESSION_POLL_MS. (Trafik realtime punya polling sendiri.)
  useEffect(() => {
    let stopped = false;
    let inFlight = false; // jangan menumpuk permintaan bila router/server sedang lambat

    setView(INITIAL_VIEW);

    const run = async (manual: boolean) => {
      if (inFlight || (!manual && document.hidden)) return;
      inFlight = true;
      setRefreshing(true);
      try {
        const res = await fetchCustomerSession(customer.id);
        if (!stopped) setView((v) => applyResult(v, res, Date.now(), manual));
      } catch {
        // waktu habis / jaringan putus: jangan biarkan layar berputar selamanya
        if (!stopped) setView((v) => applyResult(v, requestFailed({ customerName: customer.name, connectionType: customer.connectionType }), Date.now(), manual));
      } finally {
        inFlight = false;
        if (!stopped) setRefreshing(false);
      }
    };

    runCheck.current = (manual) => void run(manual);
    void run(false);
    const id = setInterval(() => void run(false), SESSION_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [customer]);

  // Detik "diperbarui … lalu" hanya berdetak selama data yang tampil sedang basi.
  const [, setTick] = useState(0);
  const isStale = view.stale !== null;
  useEffect(() => {
    if (!isStale) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isStale]);

  const data      = view.shown;
  const isHotspot = customer.connectionType === 'hotspot';
  const loading   = data === null;
  const look      = data ? lookOf(data.state, data.connectionType) : null;
  const staleSec  = view.stale && view.lastGood ? Math.max(0, Math.round((Date.now() - view.lastGood.at) / 1000)) : 0;

  return (
    <div style={{ width: '100%' }}>
      {/* Header: "Cari lain" kiri, nama pelanggan di tengah, muat ulang kanan */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-2)', fontSize: 13, padding: 0, fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={14} /> Cari lain
        </button>
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <h2 style={{
            fontSize: 16, fontWeight: 700, color: 'var(--text-1)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
          }}>
            {customer.name}
          </h2>
          <TypeBadge type={customer.connectionType} />
          {look && (
            <span
              data-testid="status-dot"
              title={look.label}
              style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: look.color }}
            />
          )}
        </div>
        <button
          onClick={() => runCheck.current(true)}
          aria-label="Muat ulang sesi"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 4, flexShrink: 0 }}
        >
          <RefreshCw size={14} style={refreshing ? { animation: 'monSpin 0.7s linear infinite' } : {}} />
        </button>
      </div>

      {/* Data lama masih ditampilkan karena pengecekan terbaru gagal */}
      {view.stale && (
        <p
          role="status"
          data-testid="stale-banner"
          style={{
            marginBottom: 12, padding: '8px 12px', borderRadius: 10, fontSize: 12, textAlign: 'center',
            color: 'var(--text-2)', background: 'rgba(202,138,4,0.10)', border: '1px solid rgba(202,138,4,0.30)',
          }}
        >
          Router belum merespons — menampilkan data dari {staleSec} detik lalu. Mencoba lagi otomatis.
        </p>
      )}

      {/* Memuat pertama kali (dibatasi waktu: paling lama ±20 detik, lalu berganti pesan) */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
          <RefreshCw size={24} style={{ animation: 'monSpin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13 }}>Memeriksa sesi...</p>
        </div>
      )}

      {/* Semua keadaan selain Online */}
      {data && data.state !== 'online' && (
        <Notice
          data={data}
          onRetry={() => runCheck.current(true)}
          retrying={refreshing}
          onSync={() => sync.mutate(customer.id)}
          syncing={sync.isPending}
        />
      )}

      {/* Online */}
      {data && data.state === 'online' && data.session && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Info Sesi */}
          <SessionInfoCard data={data} isHotspot={isHotspot} />

          {/* Traffic realtime (PPPoE saja) */}
          {!isHotspot && <TrafficPanel customerId={customer.id} />}

          {/* Hotspot: hanya total data selama sesi */}
          {isHotspot && (
            <div style={{
              padding: '12px 16px', background: 'rgba(245,158,11,0.06)',
              borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)',
              fontSize: 12, color: 'var(--text-2)', textAlign: 'center',
            }}>
              📡 Traffic realtime tidak tersedia untuk Hotspot. Upload dan Download di atas adalah total data selama sesi.
            </div>
          )}

          <AssumedRouterHint data={data} />

          {/* Tombol Kick — tidak ada selama router hanya diasumsikan (backend butuh router di data pelanggan) */}
          {!data.assumedRouter && <button
            onClick={() => kick.mutate(customer.id, { onSuccess: () => runCheck.current(true) })}
            disabled={kick.isPending}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              height: 40, borderRadius: 10, border: '1px solid #EF4444',
              background: 'rgba(239,68,68,0.08)', cursor: kick.isPending ? 'not-allowed' : 'pointer',
              opacity: kick.isPending ? 0.6 : 1, fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600, color: '#DC2626',
            }}
          >
            <Power size={14} /> Putus Koneksi Sekarang
          </button>}
        </div>
      )}

      <style>{`@keyframes monSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MonitoringPage() {
  const [selected, setSelected] = useState<SearchResult | null>(null);

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Seluruh isi halaman berada di satu kolom yang diletakkan di tengah */}
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Live Monitoring</h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
            Pantau sesi PPPoE dan Hotspot pelanggan secara realtime
          </p>
        </div>

        {!selected ? (
          <SearchPanel onSelect={setSelected} />
        ) : (
          <SessionPanel customer={selected} onBack={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}
