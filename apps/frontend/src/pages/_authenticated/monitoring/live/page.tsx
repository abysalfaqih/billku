import { Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Upload, Power } from 'lucide-react';
import api from '@/lib/api';

interface TrafficPoint { rxBps: number; txBps: number; t: number; }
interface SessionResponse {
  connected: boolean;
  customerName: string;
  reason?: string;
  username?: string;
  mikrotikId?: number;
  session?: { address: string; uptime: string };
  traffic?: { rxBps: number; txBps: number } | null;
}

function formatBps(bps: number) {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${bps} bps`;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const width = 600, height = 80;
  const barWidth = width / Math.max(data.length, 1);
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return <rect key={i} x={i * barWidth} y={height - h} width={Math.max(1, barWidth - 2)} height={h} fill={color} opacity={0.3 + (i / data.length) * 0.7} rx={2} />;
      })}
    </svg>
  );
}

function LiveSessionContent() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const customerId = params.get('customerId');

  const [data, setData] = useState<SessionResponse | null>(null);
  const [history, setHistory] = useState<TrafficPoint[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (!customerId) return;

    const poll = async () => {
      try {
        const { data: res } = await api.get(`/monitoring/customers/${customerId}/session`);
        setData(res);
        if (res.connected && res.traffic) {
          setHistory((prev) => [...prev.slice(-29), { ...res.traffic, t: Date.now() }]);
        }
      } catch {
        setData({ connected: false, customerName: '-', reason: 'Gagal mengambil data' });
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [customerId]);

  const handleKick = async () => {
    if (!data?.mikrotikId || !data.username) return;
    await api.post('/monitoring/sessions/kick', { mikrotikId: data.mikrotikId, username: data.username });
  };

  const latest = history[history.length - 1];

  return (
    <div style={{ padding: '20px 24px' }}>
      <button onClick={() => navigate('/monitoring')} style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-3)',
        background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: 0,
      }}>
        <ArrowLeft size={14} /> Cari pelanggan lain
      </button>

      {!data ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Memuat...</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: data.connected ? '#10B981' : '#EF4444' }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>{data.customerName}</h1>
          </div>

          {!data.connected ? (
            <div style={{
              marginTop: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 12, padding: 14, fontSize: 13, color: '#DC2626',
            }}>
              {data.reason ?? 'Pelanggan tidak sedang online'}
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
                {data.username} · IP {data.session?.address} · Uptime {data.session?.uptime}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Download size={14} style={{ color: '#0EA5E9' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Download</span>
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)' }}>{latest ? formatBps(latest.rxBps) : '—'}</p>
                  <div style={{ marginTop: 12 }}><Sparkline data={history.map((h) => h.rxBps)} color="#0EA5E9" /></div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Upload size={14} style={{ color: '#8B5CF6' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Upload</span>
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)' }}>{latest ? formatBps(latest.txBps) : '—'}</p>
                  <div style={{ marginTop: 12 }}><Sparkline data={history.map((h) => h.txBps)} color="#8B5CF6" /></div>
                </div>
              </div>

              <button onClick={handleKick} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
                border: '1px solid #EF4444', background: 'rgba(239,68,68,0.08)', cursor: 'pointer',
                fontSize: 13, color: '#DC2626',
              }}>
                <Power size={13} /> Putus Koneksi
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function LiveSessionPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Memuat...</div>}>
      <LiveSessionContent />
    </Suspense>
  );
}