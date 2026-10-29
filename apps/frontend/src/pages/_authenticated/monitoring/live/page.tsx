import { Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Power } from 'lucide-react';
import api from '@/lib/api';
import { TrafficPair } from '../components/traffic-card';
import { appendSample, toSample } from '../components/traffic-trace';
import type { TrafficSample } from '../components/traffic-trace';

// Halaman ini mengambil sesi + trafik sekaligus lewat satu endpoint, jadi selangnya lebih longgar.
const LIVE_POLL_MS = 3000;

interface SessionResponse {
  connected: boolean;
  customerName: string;
  reason?: string;
  username?: string;
  mikrotikId?: number;
  session?: { address: string; uptime: string };
  traffic?: { rxBps: number; txBps: number } | null;
}

function LiveSessionContent() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const customerId = params.get('customerId');

  const [data, setData] = useState<SessionResponse | null>(null);
  const [history, setHistory] = useState<TrafficSample[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (!customerId) return;

    const poll = async () => {
      try {
        const { data: res } = await api.get(`/monitoring/customers/${customerId}/session`);
        setData(res);
        if (res.connected && res.traffic) {
          const sample = toSample(Date.now(), res.traffic.rxBps, res.traffic.txBps);
          setHistory((prev) => appendSample(prev, sample, LIVE_POLL_MS));
        }
      } catch {
        setData({ connected: false, customerName: '-', reason: 'Gagal mengambil data' });
      }
    };

    poll();
    intervalRef.current = setInterval(poll, LIVE_POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [customerId]);

  const handleKick = async () => {
    if (!data?.mikrotikId || !data.username) return;
    await api.post('/monitoring/sessions/kick', { mikrotikId: data.mikrotikId, username: data.username });
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
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

                <div style={{ marginBottom: 16 }}>
                  <TrafficPair samples={history} intervalMs={LIVE_POLL_MS} />
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