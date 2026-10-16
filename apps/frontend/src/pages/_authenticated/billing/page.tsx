import { useState, useEffect } from 'react';
import { Plus, XCircle, CheckCircle2, FileText, FileDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { SearchInput } from '@/components/ui/search-input';
import { GenerateDialog } from './components/generate-dialog';
import { PayDialog } from './components/pay-dialog';
import { useBills, useCancelBill, openInvoicePdf } from '@/hooks/useBilling';
import type { Bill } from '@/types';
import { Link, useSearchParams } from 'react-router-dom';
import { useExportCsv } from '@/hooks/useExportCsv';

const STATUS_TABS = [
  { key: '', label: 'Semua' },
  { key: 'unpaid', label: 'Belum Bayar' },
  { key: 'paid', label: 'Lunas' },
  { key: 'overdue', label: 'Jatuh Tempo' },
  { key: 'cancelled', label: 'Dibatalkan' },
];

function formatRp(v: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(v));
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BillingPage() {
  // ?search= bisa diisi dari tautan lain (mis. "Lihat semua tagihan" di pencarian atas)
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') ?? '';

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(urlSearch);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Bill | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Bill | null>(null);
  const exportBilling = useExportCsv('/billing/export', `tagihan-${new Date().toISOString().split('T')[0]}.csv`);

  const { data, isLoading } = useBills({ page, limit: 20, status: status || undefined, search: search || undefined });
  const cancelBill = useCancelBill();

  // Halaman ini tidak remount kalau ?search= berubah saat sudah di /billing
  useEffect(() => {
    setSearch(urlSearch);
    setSearchInput(urlSearch);
    setPage(1);
  }, [urlSearch]);

  const submitSearch = (v: string) => {
    setSearch(v.trim());
    setPage(1);
  };

  const statusVariant: Record<string, 'paid' | 'unpaid' | 'overdue' | 'cancelled'> = {
    paid: 'paid', unpaid: 'unpaid', overdue: 'overdue', cancelled: 'cancelled',
  };

  return (
    <>
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
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>Tagihan</h1>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
                {data?.meta.total ?? 0} total tagihan
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setGenerateOpen(true)}>
                Generate Tagihan
              </Button>
              <Button variant="outline" size="sm" icon={<Download size={14} />} loading={exportBilling.loading} onClick={exportBilling.download}>
                Export CSV
              </Button>
            </div>
          </div>

          {/* Status tabs */}
          <div style={{ display: 'flex', overflowX: 'auto' }}>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setStatus(tab.key); setPage(1); }}
                style={{
                  padding: '10px 16px', fontSize: 13, fontWeight: 500,
                  border: 'none', cursor: 'pointer', background: 'none', whiteSpace: 'nowrap',
                  borderBottom: `2px solid ${status === tab.key ? '#4F46E5' : 'transparent'}`,
                  color: status === tab.key ? '#4F46E5' : 'var(--text-3)',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div style={{ padding: '12px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex' }}>
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={submitSearch}
            active={!!search}
            placeholder="Cari no. tagihan, nama, HP, kode pelanggan... (Enter)"
          />
        </div>

        {/* Table */}
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
              <FileText size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
                {search ? 'Tagihan tidak ditemukan' : 'Belum ada tagihan'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                {search
                  ? `Tidak ada hasil untuk "${search}"`
                  : 'Klik "Generate Tagihan" untuk membuat tagihan baru'}
              </p>
            </div>
          ) : (
            <>
              <div style={{
                background: 'var(--surface)', borderRadius: 16,
                border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                overflowX: 'auto', WebkitOverflowScrolling: 'touch',
              }}>
                <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      {['No. Tagihan', 'Pelanggan', 'Periode', 'Jatuh Tempo', 'Paket', 'Jumlah', 'Status', '', ''].map((h, i) => (
                        <th key={`${h}-${i}`} style={{
                          padding: '10px 16px', textAlign: 'left', fontSize: 11,
                          fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.05em',
                          textTransform: 'uppercase', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((bill) => (
                      <tr
                        key={bill.id}
                        style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <Link
                            to={`/billing/${bill.id}`}
                            style={{
                              fontSize: 12, fontFamily: 'monospace', fontWeight: 600,
                              color: 'var(--nav-active-text)', textDecoration: 'none',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                          >
                            {bill.billNumber}
                          </Link>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {bill.customerName ? (
                            <Link
                              to={`/customers/${bill.customerId}`}
                              style={{ fontSize: 13, fontWeight: 600, color: 'var(--nav-active-text)', textDecoration: 'none' }}
                              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {bill.customerName}
                            </Link>
                          ) : (
                            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <p style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                            {formatDate(bill.periodStart)} — {formatDate(bill.periodEnd)}
                          </p>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <p style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                            {formatDate(bill.dueDate)}
                          </p>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{bill.packageName}</p>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
                            {formatRp(bill.totalAmount)}
                          </p>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant={statusVariant[bill.status] ?? 'default'} />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={() => openInvoicePdf(bill.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 10px',
                              borderRadius: 7,
                              border: '1px solid var(--border)',
                              background: 'var(--surface-2)',
                              cursor: 'pointer',
                              fontSize: 12,
                              color: 'var(--text-2)',
                            }}
                          >
                            <FileDown size={12} /> Invoice
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {(bill.status === 'unpaid' || bill.status === 'overdue') && (
                              <button
                                onClick={() => setPayTarget(bill)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  padding: '5px 10px', borderRadius: 7, border: '1px solid #10B981',
                                  background: 'rgba(16,185,129,0.08)', cursor: 'pointer',
                                  fontSize: 12, fontWeight: 500, color: '#059669',
                                }}
                              >
                                <CheckCircle2 size={12} /> Lunas
                              </button>
                            )}
                            {bill.status !== 'paid' && bill.status !== 'cancelled' && (
                              <button
                                onClick={() => setCancelTarget(bill)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)',
                                  background: 'var(--surface-2)', cursor: 'pointer',
                                  fontSize: 12, color: 'var(--text-3)',
                                }}
                              >
                                <XCircle size={12} /> Batal
                              </button>
                            )}
                          </div>
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

      <GenerateDialog open={generateOpen} onClose={() => setGenerateOpen(false)} />

      <PayDialog
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        bill={payTarget}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget) cancelBill.mutate(cancelTarget.id, { onSuccess: () => setCancelTarget(null) });
        }}
        loading={cancelBill.isPending}
        title="Batalkan Tagihan?"
        description={`Tagihan ${cancelTarget?.billNumber} akan dibatalkan. Tindakan ini tidak dapat diurungkan.`}
        confirmLabel="Batalkan Tagihan"
      />
    </>
  );
}