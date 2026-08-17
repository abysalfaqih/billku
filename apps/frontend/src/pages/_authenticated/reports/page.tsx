import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, FileText, Users, Calendar } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useRevenueReport, useBillsReport, useCustomersReport } from '@/hooks/useReports';
import api from '@/lib/api';

function formatRp(v: number | string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(v));
}

function formatRpCompact(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}Jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const STATUS_COLOR: Record<string, string> = {
  unpaid: '#F59E0B', paid: '#10B981', overdue: '#EF4444', cancelled: '#6B7280',
};
const STATUS_LABEL: Record<string, string> = {
  unpaid: 'Belum Bayar', paid: 'Lunas', overdue: 'Jatuh Tempo', cancelled: 'Dibatalkan',
};

// ─── Bar Chart ───────────────────────────────────────────────────────────────
function BarChart({
  data, color = '#4F46E5', height = 140, formatValue = String,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div style={{ position: 'relative' }}>
      {/* Tooltip */}
      {hovered !== null && (
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--text-1)', color: 'var(--surface)', padding: '4px 10px',
          borderRadius: 8, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 10,
          pointerEvents: 'none',
        }}>
          {data[hovered]?.label}: {formatValue(data[hovered]?.value ?? 0)}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height, paddingTop: 28 }}>
        {data.map((d, i) => {
          const barH = max > 0 ? Math.max((d.value / max) * (height - 40), d.value > 0 ? 4 : 0) : 0;
          const isHov = hovered === i;
          return (
            <div
              key={i}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{
                width: '100%', height: barH,
                background: isHov ? `${color}DD` : `${color}88`,
                borderRadius: '4px 4px 0 0',
                border: isHov ? `1px solid ${color}` : '1px solid transparent',
                transition: 'all 0.15s',
                minHeight: d.value > 0 ? 4 : 0,
              }} />
              <span style={{
                fontSize: 9, color: 'var(--text-3)', fontWeight: isHov ? 700 : 400,
                whiteSpace: 'nowrap', transition: 'color 0.15s',
              }}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Y-axis labels */}
      {max > 0 && (
        <div style={{
          position: 'absolute', top: 28, right: 0, display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', height: height - 40, pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{formatValue(max)}</span>
          <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{formatValue(Math.round(max / 2))}</span>
          <span style={{ fontSize: 9, color: 'var(--text-3)' }}>0</span>
        </div>
      )}
    </div>
  );
}

// ─── Monthly Hook ────────────────────────────────────────────────────────────
function useMonthlyReport(year: number) {
  return useQuery({
    queryKey: ['reports', 'monthly', year],
    queryFn: () => api.get('/reports/monthly', { params: { year } }).then(r => r.data),
  });
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [startDate, setStartDate] = useState(firstOfMonthStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: revenue, isLoading: loadingRevenue } = useRevenueReport(startDate, endDate);
  const { data: bills, isLoading: loadingBills } = useBillsReport();
  const { data: customers, isLoading: loadingCustomers } = useCustomersReport();
  const { data: monthly, isLoading: loadingMonthly } = useMonthlyReport(selectedYear);

  const isLoading = loadingRevenue || loadingBills || loadingCustomers;

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Laporan</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
            Pendapatan, tagihan, dan statistik pelanggan
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={14} style={{ color: 'var(--text-3)' }} />
          <input
            type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            style={{
              height: 36, padding: '0 10px', borderRadius: 8, fontSize: 13,
              background: 'var(--input-bg)', border: '1.5px solid var(--input-border)',
              color: 'var(--text-1)', outline: 'none',
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>—</span>
          <input
            type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            style={{
              height: 36, padding: '0 10px', borderRadius: 8, fontSize: 13,
              background: 'var(--input-bg)', border: '1.5px solid var(--input-border)',
              color: 'var(--text-1)', outline: 'none',
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <Spinner size="lg" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              {
                label: 'Total Pendapatan', icon: TrendingUp,
                value: formatRp(revenue?.summary?.total ?? 0),
                sub: `${revenue?.summary?.count ?? 0} transaksi`,
                color: '#10B981', bg: 'linear-gradient(135deg, #059669, #10B981)',
              },
              {
                label: 'Total Pelanggan', icon: Users,
                value: Number(customers?.total ?? 0).toLocaleString('id-ID'),
                sub: `+${customers?.newThisMonth ?? 0} bulan ini`,
                color: '#4F46E5', bg: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              },
              {
                label: 'Jatuh Tempo', icon: FileText,
                value: bills?.overdueToday ?? 0,
                sub: 'hari ini',
                color: '#EF4444', bg: 'linear-gradient(135deg, #DC2626, #EF4444)',
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} style={{
                  background: 'var(--surface)', borderRadius: 14, padding: '16px 18px',
                  border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                    background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={18} color="white" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)' }}>{s.value}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{s.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* GRAFIK BULANAN */}
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '20px 24px',
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Pendapatan Bulanan</h3>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {loadingMonthly ? '...' : `Total: ${formatRp(monthly?.summary?.totalRevenue ?? 0)}`}
                </p>
              </div>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  height: 32, padding: '0 10px', borderRadius: 8, fontSize: 13,
                  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  color: 'var(--text-1)', cursor: 'pointer', outline: 'none',
                }}
              >
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {loadingMonthly ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Spinner /></div>
            ) : (
              <BarChart
                data={(monthly?.months ?? []).map((m: any) => ({ label: m.label, value: m.revenue }))}
                color="#4F46E5"
                height={160}
                formatValue={(v) => formatRpCompact(v)}
              />
            )}
          </div>

          {/* Grafik pelanggan baru */}
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '20px 24px',
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Pelanggan Baru per Bulan</h3>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {loadingMonthly ? '...' : `Total ${monthly?.summary?.totalNewCustomers ?? 0} pelanggan baru di ${selectedYear}`}
              </p>
            </div>
            {loadingMonthly ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Spinner /></div>
            ) : (
              <BarChart
                data={(monthly?.months ?? []).map((m: any) => ({ label: m.label, value: m.newCustomers }))}
                color="#10B981"
                height={120}
                formatValue={(v) => `${v} pelanggan`}
              />
            )}
          </div>

          {/* Two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Bills by status */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Tagihan per Status</p>
              </div>
              <div>
                {bills?.byStatus?.map((s: any) => (
                  <div key={s.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[s.status] ?? '#6B7280' }} />
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{STATUS_LABEL[s.status] ?? s.status}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.count}x</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{formatRp(s.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pendapatan per metode */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Pendapatan per Metode</p>
              </div>
              <div>
                {revenue?.byMethod?.length ? revenue.byMethod.map((m: any) => (
                  <div key={m.method} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {m.method === 'cash' ? 'Tunai' : m.method === 'transfer' ? 'Transfer' : 'Lainnya'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.count}x</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{formatRp(m.total)}</span>
                    </div>
                  </div>
                )) : (
                  <p style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>Belum ada data</p>
                )}
              </div>
            </div>
          </div>

          {/* Rincian harian */}
          {revenue?.daily?.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Rincian Harian</p>
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {revenue.daily.map((d: any) => (
                  <div key={d.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{d.count} transaksi</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{formatRp(d.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}