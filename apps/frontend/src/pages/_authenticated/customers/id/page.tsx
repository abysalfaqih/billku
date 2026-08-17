import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Wifi, FileText, CreditCard, CheckCircle2, Clock,
  AlertTriangle, XCircle, Edit2, Zap, Phone, MapPin, Calendar,
  Hash, User, Network, ChevronDown, ChevronUp, Key,
} from 'lucide-react';
import { useResetPassword } from '@/hooks/useMonitoring';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CustomerForm } from '../components/customer-form';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DetailData {
  customer: any;
  package: { id: number; name: string; speedDownload: number; speedUpload: number; price: string } | null;
  area: { id: number; name: string } | null;
  bills: any[];
  payments: any[];
  totalPaid: number;
  totalUnpaid: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatRp(v: string | number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(v));
}
function formatDate(d: string | Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const METHOD_LABEL: Record<string, string> = { cash: 'Tunai', transfer: 'Transfer Bank', other: 'Lainnya' };

// ─── Sub-components ───────────────────────────────────────────────────────────
function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: 'var(--nav-active-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} style={{ color: 'var(--nav-active-icon)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', wordBreak: 'break-word' }}>{value || '—'}</p>
      </div>
    </div>
  );
}

function BillRow({ bill }: { bill: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 0', border: 'none', background: 'none', cursor: 'pointer',
          textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: bill.status === 'paid' ? 'rgba(16,185,129,0.1)'
            : bill.status === 'overdue' ? 'rgba(239,68,68,0.1)'
            : bill.status === 'unpaid' ? 'rgba(245,158,11,0.1)' : 'var(--surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {bill.status === 'paid' ? <CheckCircle2 size={16} style={{ color: '#10B981' }} />
            : bill.status === 'overdue' ? <AlertTriangle size={16} style={{ color: '#EF4444' }} />
            : bill.status === 'unpaid' ? <Clock size={16} style={{ color: '#F59E0B' }} />
            : <XCircle size={16} style={{ color: '#9CA3AF' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>{bill.packageName}</p>
          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {formatDate(bill.periodStart)} — {formatDate(bill.periodEnd)}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>
            {formatRp(bill.totalAmount)}
          </p>
          <Badge variant={bill.status} />
        </div>
        {open ? <ChevronUp size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          : <ChevronDown size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />}
      </button>

      {open && (
        <div style={{
          margin: '0 0 12px', padding: '12px 16px',
          background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)',
        }}>
          {[
            ['No. Tagihan', bill.billNumber, true],
            ['Jatuh Tempo', formatDate(bill.dueDate), false],
            ['Harga Paket', formatRp(bill.amount), false],
            ...(Number(bill.taxAmount) > 0 ? [['PPN', formatRp(bill.taxAmount), false]] : []),
            ['Total', formatRp(bill.totalAmount), false],
          ].map(([l, v, mono]) => (
            <div key={String(l)} style={{
              display: 'flex', justifyContent: 'space-between', padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{l}</span>
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-1)',
                fontFamily: mono ? 'monospace' : 'inherit',
              }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<'info' | 'tagihan' | 'pembayaran'>('info');
  const [resetPassOpen, setResetPassOpen] = useState(false);
  const [newPassword, setNewPassword]     = useState('');
  const resetPass = useResetPassword(() => { setResetPassOpen(false); setNewPassword(''); });

  const { data, isLoading, error } = useQuery<DetailData>({
    queryKey: ['customer-detail', params.id],
    queryFn: () => api.get(`/customers/${params.id}/detail`).then(r => r.data),
    enabled: !!params.id,
  });

  const handleGenerateBill = async () => {
    if (!data) return;
    setGenerating(true);
    try {
      await api.post(`/billing/generate/${data.customer.id}`);
      toast.success('Tagihan berhasil dibuat');
      qc.invalidateQueries({ queryKey: ['customer-detail', params.id] });
      setGenerateOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Gagal membuat tagihan');
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><Spinner size="lg" /></div>;
  }
  if (error || !data) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-1)', fontWeight: 600, marginBottom: 12 }}>Pelanggan tidak ditemukan</p>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Kembali</Button>
      </div>
    );
  }

  const { customer, package: pkg, bills, payments, totalPaid, totalUnpaid } = data;
  const initials = customer.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  const activeBills = bills.filter((b: any) => b.status !== 'cancelled');
  const statusVariant: Record<string, any> = { paid: 'paid', unpaid: 'unpaid', overdue: 'overdue', cancelled: 'cancelled' };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Sticky header */}
        <div style={{
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          flexShrink: 0, position: 'sticky', top: 0, zIndex: 10,
        }}>
          {/* Top bar */}
          <div style={{ padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'none',
                border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 13,
                padding: 0, fontFamily: 'inherit',
              }}
            >
              <ArrowLeft size={14} /> Kembali ke Pelanggan
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" size="sm" icon={<Key size={13} />} onClick={() => setResetPassOpen(true)}>
                Reset Password
              </Button>
              <Button variant="outline" size="sm" icon={<Edit2 size={13} />} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button size="sm" icon={<Zap size={13} />} onClick={() => setGenerateOpen(true)}>
                Generate Tagihan
              </Button>
            </div>
          </div>

          {/* Customer identity */}
          <div style={{ padding: '12px 24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, fontWeight: 800, color: 'white',
              }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                  <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)' }}>{customer.name}</h1>
                  <Badge variant={customer.status as any} />
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {customer.phone && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-3)' }}>
                      <Phone size={11} /> {customer.phone}
                    </span>
                  )}
                  {data.area && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-3)' }}>
                      <MapPin size={11} /> {data.area.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0 }}>
              {[
                { key: 'info', label: 'Info', icon: User },
                { key: 'tagihan', label: `Tagihan (${activeBills.length})`, icon: FileText },
                { key: 'pembayaran', label: `Pembayaran (${payments.length})`, icon: CreditCard },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key as any)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '8px 14px', fontSize: 13, fontWeight: 500,
                    border: 'none', cursor: 'pointer', background: 'none',
                    whiteSpace: 'nowrap', fontFamily: 'inherit',
                    borderBottom: `2px solid ${tab === key ? '#4F46E5' : 'transparent'}`,
                    color: tab === key ? '#4F46E5' : 'var(--text-3)',
                    transition: 'all 0.15s', marginBottom: -1,
                  }}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Stats — tampil di semua tab */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Total Dibayar', value: formatRp(totalPaid), sub: `${payments.length} transaksi`, color: '#10B981' },
                { label: 'Tunggakan', value: formatRp(totalUnpaid), sub: totalUnpaid > 0 ? 'Perlu dibayar' : 'Tidak ada tunggakan', color: totalUnpaid > 0 ? '#EF4444' : 'var(--text-1)' },
                { label: 'Total Tagihan', value: String(activeBills.length), sub: 'tagihan dibuat', color: 'var(--text-1)' },
              ].map(s => (
                <div key={s.label} style={{
                  padding: '14px 16px', background: 'var(--surface)', borderRadius: 12,
                  border: '1px solid var(--border)', textAlign: 'center',
                }}>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Tab: Info */}
            {tab === 'info' && (
              <>
                {/* Package card */}
                {pkg ? (
                  <div style={{
                    borderRadius: 14, padding: '18px 20px', color: 'white',
                    background: customer.status === 'active'
                      ? 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1e1b4b 100%)'
                      : 'linear-gradient(135deg, #3D0404 0%, #7B1111 100%)',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div>
                          <p style={{ fontSize: 9, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>Paket Internet</p>
                          <p style={{ fontSize: 16, fontWeight: 800 }}>{pkg.name}</p>
                        </div>
                        <Wifi size={18} style={{ opacity: 0.3 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
                        {[['Download', pkg.speedDownload], ['Upload', pkg.speedUpload]].map(([l, v]) => (
                          <div key={String(l)}>
                            <p style={{ fontSize: 9, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{l}</p>
                            <p style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>
                              {v}<span style={{ fontSize: 11, fontWeight: 400, opacity: 0.65 }}> Mbps</span>
                            </p>
                          </div>
                        ))}
                      </div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 12 }}>
                        <p style={{ fontSize: 15, fontWeight: 800 }}>
                          {formatRp(pkg.price)}<span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6 }}>/bulan</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 20, borderRadius: 14, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                    Belum ada paket internet
                  </div>
                )}

                {/* Info pribadi */}
                <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '16px 20px', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    Informasi Pribadi
                  </p>
                  <InfoItem icon={Phone} label="Nomor HP" value={customer.phone} />
                  <InfoItem icon={MapPin} label="Area" value={data.area?.name ?? '—'} />
                  <InfoItem icon={User} label="Alamat" value={customer.address ?? '—'} />
                  <InfoItem icon={Hash} label="NIK" value={customer.nik ?? '—'} />
                  <InfoItem icon={Calendar} label="Tgl. Instalasi" value={formatDate(customer.installationDate)} />
                  <InfoItem icon={Calendar} label="Tgl. Tagihan" value={`Setiap tanggal ${customer.billingDate}`} />
                  {customer.notes && (
                    <InfoItem icon={FileText} label="Catatan" value={customer.notes} />
                  )}
                </div>

                {/* Info jaringan */}
                {customer.usernamePppoe && (
                  <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '16px 20px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      Informasi Jaringan
                    </p>
                    {/* Tipe koneksi */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Tipe Koneksi</span>
                      <span style={{ marginLeft: 'auto' }}>
                        {customer.connectionType === 'hotspot' ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                            background: 'rgba(245,158,11,0.1)', color: '#B45309',
                            border: '1px solid rgba(245,158,11,0.25)',
                          }}>Hotspot</span>
                        ) : (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                            background: 'rgba(79,70,229,0.1)', color: '#4338CA',
                            border: '1px solid rgba(79,70,229,0.25)',
                          }}>🔌 PPPoE</span>
                        )}
                      </span>
                    </div>

                    <InfoItem icon={Network} label="Username" value={customer.usernamePppoe} />

                    {customer.connectionType === 'hotspot' && customer.hotspotProfile && (
                      <InfoItem icon={Wifi} label="Profile Hotspot" value={customer.hotspotProfile} />
                    )}
                    {customer.connectionType === 'pppoe' && customer.ipAddress && (
                      <InfoItem icon={Network} label="IP Address" value={customer.ipAddress} />
                    )}
                  </div>
                )}
              </>
            )}

            {/* Tab: Tagihan */}
            {tab === 'tagihan' && (
              <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '16px 20px', border: '1px solid var(--border)' }}>
                {!bills.length ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
                    <FileText size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <p style={{ fontSize: 13 }}>Belum ada riwayat tagihan</p>
                  </div>
                ) : bills.map((b: any) => <BillRow key={b.id} bill={b} />)}
              </div>
            )}

            {/* Tab: Pembayaran */}
            {tab === 'pembayaran' && (
              <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '16px 20px', border: '1px solid var(--border)' }}>
                {!payments.length ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
                    <CreditCard size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <p style={{ fontSize: 13 }}>Belum ada riwayat pembayaran</p>
                  </div>
                ) : payments.map((p: any, i: number) => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                    borderBottom: i < payments.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: 'rgba(16,185,129,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CheckCircle2 size={16} style={{ color: '#10B981' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>
                        {METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatDateTime(p.paidAt)}</p>
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#10B981' }}>{formatRp(p.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CustomerForm
        open={editOpen}
        onClose={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ['customer-detail', params.id] }); }}
        customer={data.customer}
      />

      <Dialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Generate Tagihan"
        subtitle={`Buat tagihan bulan ini untuk ${customer.name}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setGenerateOpen(false)}>Batal</Button>
            <Button size="sm" icon={<Zap size={13} />} loading={generating} onClick={handleGenerateBill}>Generate</Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Tagihan akan dibuat berdasarkan paket aktif pelanggan. Jika sudah ada tagihan untuk periode ini, sistem akan memberikan notifikasi.
        </p>
      </Dialog>

      <Dialog
        open={resetPassOpen}
        onClose={() => { setResetPassOpen(false); setNewPassword(''); }}
        title="Reset Password"
        subtitle={`${customer.name} — ${customer.connectionType === 'hotspot' ? 'Hotspot' : 'PPPoE'}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setResetPassOpen(false); setNewPassword(''); }}>
              Batal
            </Button>
            <Button
              size="sm"
              icon={<Key size={13} />}
              loading={resetPass.isPending}
              onClick={() => resetPass.mutate({ customerId: customer.id, newPassword })}
            >
              Reset Password
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Password baru akan langsung disync ke {customer.connectionType === 'hotspot' ? 'Mikrotik Hotspot' : 'RADIUS dan Mikrotik PPPoE'}.
          </p>
          <Input
            label="Password Baru"
            type="text"
            placeholder="Masukkan password baru..."
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoFocus
          />
        </div>
      </Dialog>
    </>
  );
}