import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@/components/ui/spinner';
import api from '@/lib/api';
import {
  Users, FileText, TrendingUp,
  AlertTriangle, UserX, CreditCard,
} from 'lucide-react';

function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard').then((r) => r.data),
    refetchInterval: 60_000,
  });
}

function formatRp(v: number | string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Number(v));
}

function StatCard({
  label, value, sub, icon: Icon, gradient,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  gradient: string;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '18px 20px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        minWidth: 0,
        transition: 'transform 0.15s ease',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8,
        }}>
          {label}
        </p>
        <p style={{
          fontSize: 26, fontWeight: 700, color: 'var(--text-1)',
          lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value}
        </p>
        {sub && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{sub}</p>
        )}
      </div>

      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: gradient,
      }}>
        <Icon size={19} color="white" strokeWidth={1.75} />
      </div>
    </div>
  );
}

function RevenueCard({ total, count }: { total: number; count: number }) {
  const period = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div style={{
      borderRadius: 16,
      padding: '24px',
      color: 'white',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 45%, #4338ca 100%)',
      boxShadow: '0 4px 24px rgba(30,64,175,0.35)',
      height: '100%',
      minHeight: 170,
    }}>
      {/* Decorative */}
      <div style={{
        position: 'absolute', top: -50, right: -50,
        width: 200, height: 200, borderRadius: '50%',
        background: 'rgba(255,255,255,0.06)',
      }} />
      <div style={{
        position: 'absolute', bottom: -80, right: 30,
        width: 240, height: 240, borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)',
      }} />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={15} style={{ opacity: 0.7 }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
              Pendapatan Bulanan
            </span>
          </div>
          <span style={{ fontSize: 12, opacity: 0.55 }}>{period}</span>
        </div>

        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginBottom: 4 }}>
          Total Pendapatan
        </p>
        <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16 }}>
          {formatRp(total)}
        </p>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={13} style={{ opacity: 0.6 }} />
          <span style={{ fontSize: 12, opacity: 0.65 }}>{count} transaksi bulan ini</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  const bySt = (list: any[], st: string) =>
    list?.find((s: any) => s.status === st) ?? { count: 0, total: '0' };

  const activeCount   = bySt(data?.customers?.byStatus, 'active').count ?? 0;
  const isolatedCount = bySt(data?.customers?.byStatus, 'isolated').count ?? 0;
  const unpaidBill    = bySt(data?.bills?.byStatus, 'unpaid');
  const overdueCount  = data?.bills?.overdueToday ?? 0;
  const totalCount    = data?.customers?.total ?? 0;

  return (
    <div style={{ padding: '20px 24px', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Dashboard</h1>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Spinner size="lg" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Row 1: Revenue + 4 stat cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)',
            gap: 16,
          }}>
            {/* Revenue card */}
            <RevenueCard
              total={Number(data?.revenue?.summary?.total ?? 0)}
              count={data?.revenue?.summary?.count ?? 0}
            />

            {/* 2x2 stat grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 16,
            }}>
              <StatCard
                label="Pelanggan Aktif"
                value={Number(activeCount).toLocaleString('id-ID')}
                sub={`+${data?.customers?.newThisMonth ?? 0} baru bulan ini`}
                icon={Users}
                gradient="linear-gradient(135deg, #0EA5E9, #38BDF8)"
              />
              <StatCard
                label="Diisolir"
                value={Number(isolatedCount).toLocaleString('id-ID')}
                icon={UserX}
                gradient="linear-gradient(135deg, #EF4444, #F97316)"
              />
              <StatCard
                label="Tagihan Belum Bayar"
                value={Number(unpaidBill.count).toLocaleString('id-ID')}
                sub={formatRp(unpaidBill.total)}
                icon={FileText}
                gradient="linear-gradient(135deg, #F59E0B, #FCD34D)"
              />
              <StatCard
                label="Jatuh Tempo Hari Ini"
                value={Number(overdueCount).toLocaleString('id-ID')}
                sub="perlu ditindaklanjuti"
                icon={AlertTriangle}
                gradient="linear-gradient(135deg, #EA580C, #FB923C)"
              />
            </div>
          </div>

          {/* Row 2: Total pelanggan + Daily breakdown */}
          <div style={{
            display: 'grid',
            gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
            gap: 16,
          }}>
            <StatCard
              label="Total Pelanggan"
              value={Number(totalCount).toLocaleString('id-ID')}
              icon={Users}
              gradient="linear-gradient(135deg, #8B5CF6, #A78BFA)"
            />

            {/* Daily revenue */}
            {data?.revenue?.daily?.length > 0 && (
              <div style={{
                gridColumn: 'span 2',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                    Transaksi 7 hari terakhir
                  </p>
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 99,
                    background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)',
                  }}>
                    {new Date().toLocaleDateString('id-ID', { month: 'long' })}
                  </span>
                </div>

                {data.revenue.daily.slice(-7).map((d: any) => (
                  <div key={d.date} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 20px', borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {new Date(d.date).toLocaleDateString('id-ID', {
                        weekday: 'short', day: 'numeric', month: 'short',
                      })}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{d.count} trx</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatRp(d.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}