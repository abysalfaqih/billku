import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useSessionTraffic } from '@/hooks/useMonitoring';
import {
  BASE_Y,
  CHART_H,
  CHART_W,
  MID_Y,
  PLOT_W,
  TOP_Y,
  TRAFFIC_POLL_MS,
  appendSample,
  buildTrace,
  formatAxis,
  formatBps,
  formatBpsParts,
  probeAt,
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

// Angka di garis skala: kecil, dengan "halo" warna kartu supaya tetap terbaca bila tertimpa garis data.
const AXIS_TEXT = {
  fontSize: 10, fill: 'var(--text-2)', paintOrder: 'stroke', stroke: 'var(--surface)',
  strokeWidth: 3, strokeLinejoin: 'round',
} as const;

export function TrafficCard({ kind, samples, now, intervalMs, emptyLabel = 'Mengumpulkan data…' }: CardProps) {
  const { label, color, glow, Icon } = CARD[kind];
  const points = useMemo(
    () => samples.map((s) => ({ t: s.t, v: kind === 'down' ? s.down : s.up })),
    [samples, kind],
  );

  // Skala diingat antarframe agar tidak turun-naik tiap polling (lihat pickScale). Kalau data
  // berganti total, skala yang usang langsung turun sendiri pada frame pertama berkat pickScale.
  const scaleRef = useRef<number | null>(null);
  const trace = buildTrace(points, now, intervalMs, scaleRef.current);
  if (trace.hasLine) scaleRef.current = trace.scale;
  const big = trace.latest === null ? null : formatBpsParts(trace.latest);

  // Info saat kursor diarahkan / grafik disentuh: posisi dalam koordinat grafik (0–CHART_W).
  const [hoverX, setHoverX] = useState<number | null>(null);
  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width > 0) setHoverX(((e.clientX - r.left) / r.width) * CHART_W);
  };
  const probe = hoverX !== null && trace.hasLine ? probeAt(points, now, intervalMs, hoverX, trace.scale) : null;
  const anchor = probe ? probe.x / PLOT_W : 0;
  const tipBelow = probe ? probe.y < 40 : false;

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

      <div
        data-testid={`traffic-${kind}-chart`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHoverX(null)}
        onPointerCancel={() => setHoverX(null)}
        style={{ position: 'relative', marginTop: 10, cursor: 'crosshair', touchAction: 'pan-y' }}
      >
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          width="100%"
          role="img"
          aria-label={`Grafik kecepatan ${label.toLowerCase()} 60 detik terakhir`}
          style={{ display: 'block' }}
        >
          <line x1="0" y1={TOP_Y} x2={CHART_W} y2={TOP_Y} style={{ stroke: 'var(--chart-grid)', strokeDasharray: '3 5' }} />
          <line x1="0" y1={MID_Y} x2={CHART_W} y2={MID_Y} style={{ stroke: 'var(--chart-grid)', strokeDasharray: '3 5' }} />
          <line x1="0" y1={BASE_Y} x2={CHART_W} y2={BASE_Y} style={{ stroke: 'var(--chart-grid)' }} />

          {trace.hasLine ? (
            <>
              <text data-testid={`traffic-${kind}-tick-top`} x="2" y={TOP_Y - 3} style={AXIS_TEXT}>{formatAxis(trace.scale)}</text>
              <text data-testid={`traffic-${kind}-tick-mid`} x="2" y={MID_Y - 3} style={AXIS_TEXT}>{formatAxis(trace.scale / 2)}</text>
              <text data-testid={`traffic-${kind}-tick-base`} x="2" y={BASE_Y + 10} style={AXIS_TEXT}>0</text>
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
              {probe && (
                <>
                  <line
                    data-testid={`traffic-${kind}-crosshair`}
                    x1={probe.x} y1={TOP_Y} x2={probe.x} y2={BASE_Y}
                    style={{ stroke: 'var(--text-2)', strokeWidth: 1, strokeDasharray: '2 3' }}
                  />
                  <circle
                    data-testid={`traffic-${kind}-probe`} cx={probe.x} cy={probe.y} r={4.5}
                    style={{ fill: color, stroke: 'var(--surface)', strokeWidth: 2 }}
                  />
                </>
              )}
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

        {probe && (
          <div
            role="tooltip"
            data-testid={`traffic-${kind}-tip`}
            style={{
              position: 'absolute', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2,
              left: `${(probe.x / CHART_W) * 100}%`, top: `${(probe.y / CHART_H) * 100}%`,
              transform: `translate(-${Math.round(anchor * 100)}%, ${tipBelow ? '10px' : 'calc(-100% - 10px)'})`,
              background: 'var(--chart-tip-bg)', color: 'var(--chart-tip-fg)',
              borderRadius: 8, padding: '5px 9px', boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{formatBps(probe.v)}</div>
            <div style={{ fontSize: 10.5, lineHeight: 1.3, opacity: 0.8 }}>
              {probe.ageSec === 0 ? 'sekarang' : `${probe.ageSec} dtk lalu`}
            </div>
          </div>
        )}
      </div>

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
        60 detik terakhir · diperbarui tiap {intervalMs / 1000} detik · tunjuk atau sentuh grafik untuk melihat nilainya
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
