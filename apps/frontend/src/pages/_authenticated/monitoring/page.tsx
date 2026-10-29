import { useState, useEffect, useRef } from 'react';
import { Search, WifiOff, Power, RefreshCw, ArrowLeft } from 'lucide-react';
import { useCustomerSession, useKickSession } from '@/hooks/useMonitoring';
import type { SessionResponse } from '@/hooks/useMonitoring';
import api from '@/lib/api';
import { SessionInfoCard } from './components/session-info-card';
import { TrafficPanel } from './components/traffic-card';

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

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/monitoring/search', { params: { q: query } });
        setResults(data);
      } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div style={{ maxWidth: 540, width: '100%', margin: '0 auto' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        borderRadius: 12, background: 'var(--input-bg)', border: '1.5px solid var(--input-border)',
      }}>
        <Search size={16} style={{ color: 'var(--text-3)' }} />
        <input
          autoFocus placeholder="Ketik nama pelanggan..."
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
        <div style={{
          marginTop: 8, padding: 20, textAlign: 'center', background: 'var(--surface)',
          borderRadius: 12, border: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Pelanggan tidak ditemukan</p>
        </div>
      )}

      <style>{`@keyframes monSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Session Panel (PPPoE + Hotspot) ─────────────────────────────────────────
function SessionPanel({ customer, onBack }: { customer: SearchResult; onBack: () => void }) {
  const getSession   = useCustomerSession();
  const kick         = useKickSession();

  const [sessionData, setSessionData]   = useState<SessionResponse | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Fetch session pertama kali dan polling tiap 10 detik.
  // (Trafik realtime punya polling sendiri di TrafficPanel, tiap 2 detik.)
  useEffect(() => {
    const fetchSession = () => {
      getSession.mutate(customer.id, {
        onSuccess: setSessionData,
      });
    };

    fetchSession();
    intervalRef.current = setInterval(fetchSession, 10_000);
    return () => clearInterval(intervalRef.current);
  }, [customer.id]);

  const isHotspot = customer.connectionType === 'hotspot';
  const loading   = getSession.isPending && !sessionData;

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
          {sessionData && (
            <span
              title={sessionData.connected ? 'Online' : 'Offline'}
              style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: sessionData.connected ? '#10B981' : '#EF4444',
              }}
            />
          )}
        </div>
        <button
          onClick={() => getSession.mutate(customer.id, { onSuccess: setSessionData })}
          aria-label="Muat ulang sesi"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 4, flexShrink: 0 }}
        >
          <RefreshCw size={14} style={getSession.isPending ? { animation: 'monSpin 0.7s linear infinite' } : {}} />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
          <RefreshCw size={24} style={{ animation: 'monSpin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13 }}>Memeriksa sesi...</p>
        </div>
      )}

      {/* Not Found */}
      {!loading && sessionData && !sessionData.found && (
        <div style={{
          padding: '28px 20px', textAlign: 'center', background: 'var(--surface)',
          borderRadius: 14, border: '1px solid var(--border)',
        }}>
          <WifiOff size={28} style={{ color: 'var(--text-3)', margin: '0 auto 10px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
            Perangkat tidak ditemukan
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{sessionData.reason}</p>
        </div>
      )}

      {/* Offline */}
      {!loading && sessionData?.found && !sessionData.connected && (
        <div style={{
          padding: '24px 20px', textAlign: 'center', background: 'var(--surface)',
          borderRadius: 14, border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>Tidak Online</p>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>{sessionData.reason}</p>
          {sessionData.mikrotikName && (
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Mikrotik: {sessionData.mikrotikName}
            </p>
          )}
        </div>
      )}

      {/* Online */}
      {!loading && sessionData?.found && sessionData.connected && sessionData.session && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Info Sesi */}
          <SessionInfoCard data={sessionData} isHotspot={isHotspot} />

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

          {/* Tombol Kick */}
          <button
            onClick={() => kick.mutate(customer.id)}
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
          </button>
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
