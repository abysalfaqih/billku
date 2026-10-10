import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { useAgingReport } from '@/hooks/useReports';
import type { AgingBucketKey, AgingCustomerRow } from '@/types';

function formatRp(v: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(v);
}

// Makin lama menunggak, makin merah.
const BUCKET_COLOR: Record<AgingBucketKey, string> = {
  current: '#10B981',
  d1_7: '#F59E0B',
  d8_30: '#F97316',
  d31_60: '#EF4444',
  d61_90: '#DC2626',
  d90plus: '#991B1B',
};

function colorForDays(days: number): string {
  if (days > 90) return BUCKET_COLOR.d90plus;
  if (days > 60) return BUCKET_COLOR.d61_90;
  if (days > 30) return BUCKET_COLOR.d31_60;
  if (days > 7) return BUCKET_COLOR.d8_30;
  return BUCKET_COLOR.d1_7;
}

const PAGE_SIZE = 20;

// ─── Satu baris pelanggan ────────────────────────────────────────────────────
function CustomerRow({
  c, amount,
}: {
  c: AgingCustomerRow;
  amount: number;
}) {
  const color = colorForDays(c.oldestDaysOverdue);
  return (
    <Link
      // Buka tab Tagihan & sorot tagihan tertuanya (alur yang sama dengan pencarian topbar)
      to={`/customers/${c.customerId}?tab=tagihan&bill=${c.oldestBillId}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '11px 20px', borderBottom: '1px solid var(--border)',
        textDecoration: 'none', transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{c.name}</span>
          {c.status !== 'active' && <Badge variant={c.status} />}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
          <span style={{ fontFamily: 'monospace' }}>{c.customerCode ?? '—'}</span>
          {' · '}{c.phone}
          {' · '}{c.billCount} tagihan
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{formatRp(amount)}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color, marginTop: 2 }}>
          {c.oldestDaysOverdue} hari
        </p>
      </div>
    </Link>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────
export function AgingReportSection() {
  const { data, isLoading, isError } = useAgingReport();
  const [selected, setSelected] = useState<AgingBucketKey | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showTerminated, setShowTerminated] = useState(false);

  const card: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 16, overflow: 'hidden',
  };

  if (isLoading) {
    return (
      <div style={{ ...card, display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ ...card, padding: '20px 24px' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Umur Piutang</p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
          Data umur piutang tidak dapat dimuat.
        </p>
      </div>
    );
  }

  const { summary, buckets, customers, terminated } = data;
  const selectedBucket = buckets.find((b) => b.key === selected) ?? null;

  // Daftar mengikuti kelompok yang dipilih: hanya pelanggan yang punya
  // nominal di kelompok itu, dan angka yang tampil = nominal kelompok itu.
  const visible = selected
    ? customers.filter((c) => c.amounts[selected] > 0)
    : customers;
  const shown = showAll ? visible : visible.slice(0, PAGE_SIZE);

  const selectBucket = (key: AgingBucketKey) => {
    setSelected((cur) => (cur === key ? null : key));
    setShowAll(false);
  };

  const stats = [
    {
      label: 'Belum Dibayar',
      value: formatRp(summary.outstandingTotal),
      sub: `${summary.outstandingBillCount} tagihan`,
    },
    {
      label: 'Lewat Jatuh Tempo',
      value: formatRp(summary.overdueTotal),
      sub: `${summary.overdueCustomerCount} pelanggan`,
    },
    {
      label: 'Tunggakan Tertua',
      value: summary.oldestDaysOverdue > 0 ? `${summary.oldestDaysOverdue} hari` : '—',
      sub: summary.oldestDaysOverdue > 0 ? 'sejak jatuh tempo' : 'tidak ada tunggakan',
    },
  ];

  return (
    <div style={card} data-testid="aging-report">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Umur Piutang</h3>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
          Tagihan belum lunas menurut lama menunggak. Posisi hari ini, tidak terpengaruh filter tanggal.
        </p>
      </div>

      {/* Ringkasan */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)',
      }}>
        {stats.map((s) => (
          <div key={s.label}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {s.label}
            </p>
            <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginTop: 2 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Kelompok umur */}
      <div>
        {buckets.map((b) => {
          const clickable = b.key !== 'current' && b.billCount > 0;
          const isSel = selected === b.key;
          const pct = summary.outstandingTotal > 0 ? (b.total / summary.outstandingTotal) * 100 : 0;
          const color = BUCKET_COLOR[b.key];
          return (
            <button
              key={b.key}
              type="button"
              disabled={!clickable}
              aria-pressed={clickable ? isSel : undefined}
              data-testid={`aging-bucket-${b.key}`}
              onClick={() => clickable && selectBucket(b.key)}
              style={{
                width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto',
                alignItems: 'center', columnGap: 14, rowGap: 8, padding: '11px 20px', textAlign: 'left',
                background: isSel ? 'var(--surface-2)' : 'transparent', border: 'none',
                borderBottom: '1px solid var(--border)', borderLeft: `3px solid ${isSel ? color : 'transparent'}`,
                cursor: clickable ? 'pointer' : 'default', font: 'inherit',
                opacity: b.billCount === 0 ? 0.55 : 1,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: isSel ? 700 : 500 }}>{b.label}</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, paddingLeft: 16 }}>
                  {b.billCount} tagihan · {b.customerCount} pelanggan
                </p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', textAlign: 'right' }}>
                {formatRp(b.total)}
              </span>
              {/* Bar di baris sendiri: tetap terbaca di layar sempit */}
              <div style={{ gridColumn: '1 / -1', height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, minWidth: pct > 0 ? 3 : 0 }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Daftar pelanggan menunggak */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
          {selectedBucket ? `Pelanggan menunggak ${selectedBucket.label}` : 'Pelanggan menunggak'}
          <span style={{ fontWeight: 500, color: 'var(--text-3)' }}> ({visible.length})</span>
        </p>
        {selected && (
          <button
            type="button"
            onClick={() => { setSelected(null); setShowAll(false); }}
            style={{ fontSize: 12, color: '#4F46E5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Tampilkan semua kelompok
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
          Tidak ada pelanggan yang menunggak.
        </p>
      ) : (
        <div data-testid="aging-customers">
          {shown.map((c) => (
            <CustomerRow key={c.customerId} c={c} amount={selected ? c.amounts[selected] : c.total} />
          ))}
          {visible.length > PAGE_SIZE && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              style={{ width: '100%', padding: '11px 20px', fontSize: 12, fontWeight: 600, color: '#4F46E5', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            >
              {showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${visible.length})`}
            </button>
          )}
        </div>
      )}

      {/* Pelanggan berhenti — dipisah, tidak masuk angka di atas */}
      {terminated.billCount > 0 && (
        <div data-testid="aging-terminated">
          <button
            type="button"
            onClick={() => setShowTerminated((v) => !v)}
            aria-expanded={showTerminated}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
              background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit',
            }}
          >
            {showTerminated ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              Tunggakan pelanggan berhenti: {terminated.customerCount} pelanggan · {formatRp(terminated.total)}
            </span>
          </button>
          {showTerminated && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '0 20px 10px' }}>
                Tidak dihitung pada angka di atas karena pelanggannya sudah berhenti, kemungkinan sulit tertagih.
              </p>
              {terminated.customers.map((c) => (
                <CustomerRow key={c.customerId} c={c} amount={c.total} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
