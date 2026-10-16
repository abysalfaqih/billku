import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, XCircle, FileDown, User, Phone, MapPin, Hash, CreditCard, AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { PayDialog } from '../components/pay-dialog';
import { useBillDetail, useCancelBill, openInvoicePdf } from '@/hooks/useBilling';
import { useAuthStore } from '@/stores/auth.store';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatRp(v: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(v));
}
function formatDate(d: string | Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
const METHOD_LABEL: Record<string, string> = { cash: 'Tunai', transfer: 'Transfer', other: 'Lainnya' };

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
};

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{children}</h3>
    </div>
  );
}

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16,
      padding: '10px 20px', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: strong ? 15 : 13, fontWeight: strong ? 800 : 600, color: 'var(--text-1)',
        textAlign: 'right', wordBreak: 'break-word',
      }}>
        {children}
      </span>
    </div>
  );
}

// Keterangan jatuh tempo — hanya untuk tagihan yang masih harus dibayar
function dueNote(daysOverdue: number): { text: string; color: string } {
  if (daysOverdue > 0) return { text: `Terlambat ${daysOverdue} hari`, color: '#DC2626' };
  if (daysOverdue === 0) return { text: 'Jatuh tempo hari ini', color: '#B45309' };
  return { text: `Jatuh tempo ${-daysOverdue} hari lagi`, color: 'var(--text-3)' };
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function BillDetailPage() {
  const { id } = useParams();
  const billId = Number(id);
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);

  const { data, isLoading, error } = useBillDetail(Number.isInteger(billId) && billId > 0 ? billId : undefined);
  const cancelBill = useCancelBill();
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/billing'));

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-1)', fontWeight: 600, marginBottom: 12 }}>Tagihan tidak ditemukan</p>
        <Button variant="ghost" size="sm" onClick={() => navigate('/billing')}>← Ke daftar tagihan</Button>
      </div>
    );
  }

  const { bill, customer, payments, daysOverdue } = data;
  const open = bill.status === 'unpaid' || bill.status === 'overdue';
  // Pembatalan hanya boleh admin (sama dengan aturan di API)
  const canCancel = open && (role === 'admin' || role === 'super_admin');
  const taxAmount = Number(bill.taxAmount ?? 0);
  const note = open ? dueNote(daysOverdue) : null;
  const willReactivate = open && customer?.status === 'isolated';

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          flexShrink: 0, position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{
            padding: '10px 24px', minHeight: 52, display: 'flex', flexWrap: 'wrap',
            alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <button
              onClick={goBack}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'none',
                border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 13,
                padding: 0, fontFamily: 'inherit',
              }}
            >
              <ArrowLeft size={14} /> Kembali
            </button>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="outline" size="sm" icon={<FileDown size={13} />} onClick={() => openInvoicePdf(bill.id)}>
                Invoice PDF
              </Button>
              {canCancel && (
                <Button variant="outline" size="sm" icon={<XCircle size={13} />} onClick={() => setCancelOpen(true)}>
                  Batalkan
                </Button>
              )}
              {open && (
                <Button size="sm" icon={<CheckCircle2 size={13} />} onClick={() => setPayOpen(true)}>
                  Tandai Lunas
                </Button>
              )}
            </div>
          </div>

          <div style={{ padding: '4px 24px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'monospace' }}>
                {bill.billNumber}
              </h1>
              <Badge variant={bill.status} />
            </div>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginTop: 6 }}>
              {formatRp(bill.totalAmount)}
            </p>
            {note && (
              <p style={{ fontSize: 12, fontWeight: 600, color: note.color, marginTop: 2 }} data-testid="due-note">
                {note.text}
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '16px 24px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 980 }}>

            {willReactivate && (
              <div
                data-testid="reactivate-hint"
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 16px', borderRadius: 12,
                  background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)',
                }}
              >
                <AlertTriangle size={16} style={{ color: '#B45309', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: 'var(--text-1)' }}>
                  Pelanggan ini sedang <strong>diisolir</strong>. Menandai tagihan ini lunas akan
                  mengaktifkan kembali koneksinya.
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
              {/* Rincian tagihan */}
              <div style={card}>
                <CardTitle>Rincian Tagihan</CardTitle>
                <Row label="Paket">{bill.packageName}</Row>
                <Row label="Periode">{formatDate(bill.periodStart)} — {formatDate(bill.periodEnd)}</Row>
                <Row label="Jatuh tempo">{formatDate(bill.dueDate)}</Row>
                <Row label="Dibuat">{formatDate(bill.createdAt)}</Row>
                <Row label="Harga paket">{formatRp(bill.amount)}</Row>
                {taxAmount > 0 && (
                  <Row label={`PPN${bill.taxPercent ? ` (${Number(bill.taxPercent)}%)` : ''}`}>{formatRp(taxAmount)}</Row>
                )}
                <Row label="Total" strong>{formatRp(bill.totalAmount)}</Row>
                {bill.notes && (
                  <div style={{ padding: '12px 20px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Catatan</p>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{bill.notes}</p>
                  </div>
                )}
              </div>

              {/* Pelanggan */}
              <div style={card} data-testid="bill-customer">
                <CardTitle>Pelanggan</CardTitle>
                {customer ? (
                  <>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <Link
                        to={`/customers/${customer.id}`}
                        style={{ fontSize: 15, fontWeight: 700, color: 'var(--nav-active-text)', textDecoration: 'none' }}
                      >
                        {customer.name}
                      </Link>
                      <Badge variant={customer.status} />
                    </div>
                    {[
                      { icon: Hash, label: 'Kode', value: customer.customerCode },
                      { icon: Phone, label: 'No. HP', value: customer.phone },
                      { icon: MapPin, label: 'Alamat', value: customer.address },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} style={{ display: 'flex', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
                        <Icon size={14} style={{ color: 'var(--text-3)', marginTop: 2, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</p>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', wordBreak: 'break-word' }}>{value || '—'}</p>
                        </div>
                      </div>
                    ))}
                    <div style={{ padding: '12px 20px' }}>
                      <Button variant="outline" size="sm" icon={<User size={13} />} onClick={() => navigate(`/customers/${customer.id}`)}>
                        Buka profil pelanggan
                      </Button>
                    </div>
                  </>
                ) : (
                  <p style={{ padding: 20, fontSize: 13, color: 'var(--text-3)' }}>Data pelanggan tidak tersedia.</p>
                )}
              </div>
            </div>

            {/* Riwayat pembayaran */}
            <div style={card} data-testid="bill-payments">
              <CardTitle>Riwayat Pembayaran</CardTitle>
              {payments.length === 0 ? (
                <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                  <CreditCard size={22} style={{ color: 'var(--text-3)', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    {bill.status === 'cancelled' ? 'Tagihan dibatalkan, tidak ada pembayaran.' : 'Belum ada pembayaran untuk tagihan ini.'}
                  </p>
                </div>
              ) : (
                payments.map((p) => (
                  <div key={p.id} style={{
                    display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
                    padding: '12px 20px', borderBottom: '1px solid var(--border)',
                  }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                        {formatDateTime(p.paidAt)} · {METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        Dicatat oleh {p.createdByName ?? '—'}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </p>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}>
                      {formatRp(p.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <PayDialog open={payOpen} onClose={() => setPayOpen(false)} bill={bill} />

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => cancelBill.mutate(bill.id, { onSuccess: () => setCancelOpen(false) })}
        loading={cancelBill.isPending}
        title="Batalkan Tagihan?"
        description={`Tagihan ${bill.billNumber} akan dibatalkan. Tindakan ini tidak dapat diurungkan.`}
        confirmLabel="Batalkan Tagihan"
      />
    </>
  );
}
