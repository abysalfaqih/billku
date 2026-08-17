import { Suspense, useState, useEffect, useRef } from 'react';
import { Search, Wifi, WifiOff, Power, Download, Upload, RefreshCw, Radio, Router, ArrowLeft } from 'lucide-react';
import { useCustomerSession, useSessionTraffic, useKickSession } from '@/hooks/useMonitoring';
import type { SessionResponse } from '@/hooks/useMonitoring';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SearchResult {
  id: number;
  name: string;
  phone: string;
  usernamePppoe: string | null;
  connectionType: 'pppoe' | 'hotspot';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatBps(bps: number) {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  if (bps >= 1_000)     return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${bps} bps`;
}

function formatBytes(bytes: string) {
  const n = parseInt(bytes ?? '0');
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(2)} GB`;
  if (n >= 1_048_576)     return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n >= 1_024)         return `${(n / 1_024).toFixed(0)} KB`;
  return `${n} B`;
}

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

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const w = 600, h = 70;
  const bw = w / Math.max(data.length, 1);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {data.map((v, i) => {
        const barH = Math.max(2, (v / max) * h);
        return (
          <rect key={i} x={i * bw} y={h - barH}
            width={Math.max(1, bw - 2)} height={barH}
            fill={color} opacity={0.3 + (i / data.length) * 0.7} rx={2} />
        );
      })}
    </svg>
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
    <div style={{ maxWidth: 540, width: '100%' }}>
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
  const getTraffic   = useSessionTraffic();
  const kick         = useKickSession();

  const [sessionData, setSessionData]   = useState<SessionResponse | null>(null);
  const [trafficHistory, setTrafficHistory] = useState<{ rx: number; tx: number }[]>([]);
  const [polling, setPolling]           = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const trafficRef  = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Fetch session pertama kali dan polling tiap 10 detik
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

  // Traffic polling hanya untuk PPPoE yang sedang connected
  useEffect(() => {
    clearInterval(trafficRef.current);

    if (
      sessionData?.connected &&
      sessionData?.connectionType === 'pppoe'
    ) {
      setPolling(true);
      const fetchTraffic = () => {
        getTraffic.mutate(customer.id, {
          onSuccess: (data) => {
            if (data.available && data.rxBps !== undefined) {
              setTrafficHistory(prev => [...prev.slice(-29), { rx: data.rxBps!, tx: data.txBps! }]);
            }
          },
        });
      };
      fetchTraffic();
      trafficRef.current = setInterval(fetchTraffic, 3_000);
    } else {
      setPolling(false);
      setTrafficHistory([]);
    }

    return () => clearInterval(trafficRef.current);
  }, [sessionData?.connected, sessionData?.connectionType]);

  const isHotspot = customer.connectionType === 'hotspot';
  const loading   = getSession.isPending && !sessionData;

  return (
    <div style={{ maxWidth: 640, width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-3)', fontSize: 13, padding: 0, fontFamily: 'inherit',
          }}
        >
          <ArrowLeft size={14} /> Cari lain
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
            {customer.name}
          </h2>
          <TypeBadge type={customer.connectionType} />
          {sessionData && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: sessionData.connected ? '#10B981' : '#EF4444',
            }} />
          )}
        </div>
        <button
          onClick={() => getSession.mutate(customer.id, { onSuccess: setSessionData })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
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
          <div style={{
            background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px', background: 'var(--surface-2)',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Sesi Aktif
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#10B981', fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                Online
              </span>
            </div>

            <div style={{ padding: '0 16px' }}>
              {[
                ['Username', sessionData.username],
                ['IP Address', sessionData.session.address],
                ['Uptime', sessionData.session.uptime],
                ...(isHotspot ? [
                  ['MAC Address', sessionData.session.macAddress],
                  ['Data Masuk', formatBytes(sessionData.session.bytesIn ?? '0')],
                  ['Data Keluar', formatBytes(sessionData.session.bytesOut ?? '0')],
                  ['Profile', sessionData.hotspotProfile],
                ] : [
                  ['Caller ID', sessionData.session.callerId],
                ]),
                ['Mikrotik', sessionData.mikrotikName],
              ].map(([label, value]) => !value ? null : (
                <div key={String(label)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', fontFamily: 'monospace' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Traffic (PPPoE only) */}
          {!isHotspot && trafficHistory.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Download size={13} style={{ color: '#0EA5E9' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Download</span>
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginBottom: 8 }}>
                  {formatBps(trafficHistory[trafficHistory.length - 1]?.rx ?? 0)}
                </p>
                <Sparkline data={trafficHistory.map(h => h.rx)} color="#0EA5E9" />
              </div>
              <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Upload size={13} style={{ color: '#8B5CF6' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Upload</span>
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginBottom: 8 }}>
                  {formatBps(trafficHistory[trafficHistory.length - 1]?.tx ?? 0)}
                </p>
                <Sparkline data={trafficHistory.map(h => h.tx)} color="#8B5CF6" />
              </div>
            </div>
          )}

          {/* Hotspot data usage */}
          {isHotspot && (
            <div style={{
              padding: '12px 16px', background: 'rgba(245,158,11,0.06)',
              borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)',
              fontSize: 12, color: 'var(--text-3)',
            }}>
              📡 Traffic realtime tidak tersedia untuk Hotspot. Data diatas menampilkan total sesi.
            </div>
          )}

          {/* Tombol Kick */}
          <button
            onClick={() => kick.mutate(customer.id)}
            disabled={kick.isPending}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              height: 40, borderRadius: 10, border: '1px solid #EF4444',
              background: 'rgba(239,68,68,0.08)', cursor: 'pointer', fontFamily: 'inherit',
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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Live Monitoring</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
          Pantau sesi PPPoE dan Hotspot pelanggan secara realtime
        </p>
      </div>

      {!selected ? (
        <SearchPanel onSelect={setSelected} />
      ) : (
        <SessionPanel customer={selected} onBack={() => setSelected(null)} />
      )}
    </div>
  );
}