import { useState } from 'react';
import { CreditCard, Search, Download } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { Spinner } from '@/components/ui/spinner';
import { usePayments } from '@/hooks/usePayments';
import { useExportCsv } from '@/hooks/useExportCsv';
import { Button } from '@/components/ui/button';
import type { Payment } from '@/types';
import { Link } from 'react-router-dom';

function formatRp(v: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(v));
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Tunai',
  transfer: 'Transfer',
  other: 'Lainnya',
};

export default function PaymentsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePayments({ page, limit: 20 });
  const exportCsv = useExportCsv('/payments/export', `pembayaran-${new Date().toISOString().split('T')[0]}.csv`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', flexShrink: 0,
      }}>
        <div style={{
          minHeight: 60, padding: '10px 0', display: 'flex', flexWrap: 'wrap',
          alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>Riwayat Pembayaran</h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
              {data?.meta.total ?? 0} total transaksi
            </p>
          </div>
          <Button variant="outline" size="sm" icon={<Download size={14} />} loading={exportCsv.loading} onClick={exportCsv.download}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '16px 24px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Spinner size="lg" />
          </div>
        ) : !data?.data.length ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px', marginTop: 8,
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
          }}>
            <CreditCard size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
              Belum ada pembayaran
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
              Tandai tagihan sebagai lunas untuk mencatat pembayaran
            </p>
          </div>
        ) : (
          <>
            <div style={{
              background: 'var(--surface)', borderRadius: 16,
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
              overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            }}>
              <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {['Waktu', 'Pelanggan', 'Tagihan', 'Metode', 'Jumlah', 'Dicatat Oleh'].map((h) => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left', fontSize: 11,
                        fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.05em',
                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((payment) => (
                    <tr
                      key={payment.id}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
                          {formatDateTime(payment.paidAt)}
                        </p>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: 'white',
                          }}>
                            {(payment.customerName ?? '?').charAt(0).toUpperCase()}
                          </div>
                          {payment.customerName ? (
                            <Link
                              to={`/customers/${payment.customerId}`}
                              style={{ fontSize: 13, fontWeight: 600, color: 'var(--nav-active-text)', textDecoration: 'none' }}
                              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {payment.customerName}
                            </Link>
                          ) : (
                            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>#{payment.customerId}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 12, fontFamily: 'monospace', color: 'var(--nav-active-text)',
                          fontWeight: 600,
                        }}>
                          #{payment.billId}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                          {METHOD_LABEL[payment.paymentMethod] ?? payment.paymentMethod}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 14, fontWeight: 700, color: '#059669', whiteSpace: 'nowrap',
                        }}>
                          {formatRp(payment.amount)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          Admin #{payment.createdBy}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page} totalPages={data.meta.totalPages}
              total={data.meta.total} limit={data.meta.limit}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}