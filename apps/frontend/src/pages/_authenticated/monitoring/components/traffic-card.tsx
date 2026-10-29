import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useSessionTraffic } from '@/hooks/useMonitoring';
import {
  BASE_Y,
  CHART_H,
  CHART_W,
  TOP_Y,
  TRAFFIC_POLL_MS,
  appendSample,
  buildTrace,
  formatBps,
  formatBpsParts,
  toSample,
} from './traffic-trace';
import type { TrafficSample } from './traffic-trace';

// ─── Jam animasi ─────────────────────────────────────────────────────────────
// Garis digambar ulang ~30 kali per detik dari jam ini, sehingga bergerak mulus
// meski data baru hanya datang tiap beberapa detik.
function useClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());

    // Pengguna yang meminta gerak dikurangi: perbarui tiap selang polling saja.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const id = setInterval(() => setNow(Date.now()), TRAFFIC_POLL_MS);
      return () => clearInterval(id);
    }

    let raf = 0;
    let last = 0;
    const loop = (ts: number) => {
      if (ts - last >= 33) {
        last = ts;
        setNow(Date.now());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return now;
}

// ─── Satu kartu (Download atau Upload) ───────────────────────────────────────
interface CardProps {
  kind: 'down' | 'up';
  samples: TrafficSample[];
  now: number;
  intervalMs: number;
  /** teks di area grafik selagi garis belum bisa digambar */
  emptyLabel?: string;
}

const CARD = {
  down: { label: 'Download', color: 'var(--chart-down)', glow: 'var(--chart-down-glow)', Icon: ArrowDownToLine },
  up: { label: 'Upload', color: 'var(--chart-up)', glow: 'var(--chart-up-glow)', Icon: ArrowUpFromLine },
} as const;

export function TrafficCard({ kind, samples, now, intervalMs, emptyLabel = 'Mengumpulkan data…' }: CardProps) {
  const { label, color, glow, Icon } = CARD[kind];
  const points = useMemo(
    () => samples.map((s) => ({ t: s.t, v: kind === 'down' ? s.down : s.up })),
    [samples, kind],
  );
  const trace = buildTrace(points, now, intervalMs);
  const big = trace.latest === null ? null : formatBpsParts(trace.latest);

  return (
    <div
      data-testid={`traffic-${kind}`}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 16, minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Icon size={14} strokeWidth={2.2} style={{ color }} aria-hidden="true" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
      </div>

      <div
        style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          opacity: trace.latest === null || trace.fresh ? 1 : 0.5,
        }}
      >
        <span
          data-testid={`traffic-${kind}-value`}
          style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, color: 'var(--text-1)' }}
        >
          {big ? big.num : '—'}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{big ? big.unit : ''}</span>
      </div>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        width="100%"
        role="img"
        aria-label={`Grafik kecepatan ${label.toLowerCase()} 60 detik terakhir`}
        style={{ display: 'block', marginTop: 10 }}
      >
        <line x1="0" y1={TOP_Y} x2={CHART_W} y2={TOP_Y} style={{ stroke: 'var(--chart-grid)', strokeDasharray: '3 5' }} />
        <line x1="0" y1={(TOP_Y + BASE_Y) / 2} x2={CHART_W} y2={(TOP_Y + BASE_Y) / 2} style={{ stroke: 'var(--chart-grid)', strokeDasharray: '3 5' }} />
        <line x1="0" y1={BASE_Y} x2={CHART_W} y2={BASE_Y} style={{ stroke: 'var(--chart-grid)' }} />

        {trace.hasLine ? (
          <>
            <polyline
              data-testid={`traffic-${kind}-line`}
              points={trace.pts}
              fill="none"
              style={{
                stroke: color, strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round',
                filter: `drop-shadow(0 0 3px ${glow})`,
              }}
            />
            {trace.fresh && (
              <circle
                className="traffic-pulse" cx={trace.hx} cy={trace.hy} r={9}
                style={{ fill: 'none', stroke: color, strokeWidth: 1.5 }}
              />
            )}
            <circle cx={trace.hx} cy={trace.hy} r={3.5} style={{ fill: color, opacity: trace.fresh ? 1 : 0.5 }} />
          </>
        ) : (
          <text
            x={CHART_W / 2} y={CHART_H / 2} textAnchor="middle"
            style={{ fontSize: 11, fill: 'var(--text-2)' }}
          >
            {emptyLabel}
          </text>
        )}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8, fontSize: 11, color: 'var(--text-2)' }}>
        <span>Puncak {formatBps(trace.peak)}</span>
        <span>Rata-rata {formatBps(trace.avg)}</span>
      </div>
    </div>
  );
}

// ─── Sepasang kartu (dipakai halaman Monitoring dan halaman Live) ────────────
export function TrafficPair({
  samples,
  intervalMs = TRAFFIC_POLL_MS,
  emptyLabel,
}: {
  samples: TrafficSample[];
  intervalMs?: number;
  emptyLabel?: string;
}) {
  const now = useClock(samples.length > 0);
  return (
    <div>
      <div className="grid-stats-2" style={{ gap: 12 }}>
        <TrafficCard kind="down" samples={samples} now={now} intervalMs={intervalMs} emptyLabel={emptyLabel} />
        <TrafficCard kind="up" samples={samples} now={now} intervalMs={intervalMs} emptyLabel={emptyLabel} />
      </div>
      <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-2)', textAlign: 'center' }}>
        60 detik terakhir · diperbarui tiap {intervalMs / 1000} detik · skala otomatis
      </p>
    </div>
  );
}

// ─── Panel trafik PPPoE: mengambil data sendiri lalu menampilkannya ──────────
export function TrafficPanel({ customerId }: { customerId: number }) {
  const { mutateAsync } = useSessionTraffic();
  const fetchTraffic = useRef(mutateAsync);
  useEffect(() => {
    fetchTraffic.current = mutateAsync;
  }, [mutateAsync]);

  const [samples, setSamples] = useState<TrafficSample[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setSamples([]);
    setProblem(null);

    let stopped = false;
    let inFlight = false; // jangan menumpuk permintaan bila router sedang lambat

    const tick = async () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const data = await fetchTraffic.current(customerId);
        if (stopped) return;
        if (data.available && data.rxBps !== undefined && data.txBps !== undefined) {
          const sample = toSample(Date.now(), data.rxBps, data.txBps);
          setSamples((prev) => appendSample(prev, sample, TRAFFIC_POLL_MS));
          setProblem(null);
        } else {
          setProblem(data.reason ?? 'Data trafik belum tersedia.');
        }
      } catch {
        if (!stopped) setProblem('Gagal mengambil data trafik.');
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const id = setInterval(tick, TRAFFIC_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [customerId]);

  return (
    <div>
      <TrafficPair samples={samples} emptyLabel={problem && samples.length === 0 ? 'Data tidak tersedia' : undefined} />
      {problem && (
        <p
          role="status"
          style={{
            marginTop: 8, padding: '8px 12px', borderRadius: 10, fontSize: 12, textAlign: 'center',
            color: 'var(--text-2)', background: 'var(--surface)', border: '1px solid var(--border)',
          }}
        >
          {problem}
        </p>
      )}
    </div>
  );
}
