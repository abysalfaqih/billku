import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Download, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface TenantInvoiceRow {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  periodMonth: number;
  periodYear: number;
  totalAmount: string;
  status: 'draft' | 'sent' | 'paid';
  tenantId: string;
  tenantName: string;
}

interface Tenant { id: string; name: string; bandwidthEnabled: boolean; }

const PERIOD_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const STATUS_VARIANT: Record<string, any> = {
  draft: 'default', sent: 'info', paid: 'paid',
};

function formatRp(v: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(v));
}

function CreateInvoiceDialog({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tenantId, setTenantId]         = useState('');
  const [periodMonth, setPeriodMonth]    = useState(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear]      = useState(new Date().getFullYear());
  const [ppnPercent, setPpnPercent]      = useState(11);
  const [payDesc, setPayDesc]            = useState('');
  const [authorizedBy, setAuthorizedBy]  = useState('');
  const [authorizedTitle, setTitle]      = useState('Finance');
  const [loading, setLoading]            = useState(false);

  const { data: tenants } = useQuery<Tenant[]>({
    queryKey: ['tenants-list'],
    queryFn: () => api.get('/tenants').then(r => r.data),
  });

  const bandwidthTenants = (tenants ?? []).filter(t => t.bandwidthEnabled);

  const handleCreate = async () => {
    if (!tenantId) return toast.error('Pilih mitra terlebih dahulu');
    setLoading(true);
    try {
      await api.post(`/tenant-invoices/${tenantId}/auto-bandwidth`, {
        periodMonth, periodYear, ppnPercent, paymentDescription: payDesc,
        authorizedBy, authorizedTitle,
      });
      toast.success('Invoice berhasil dibuat');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Gagal membuat invoice');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 480,
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>
          Buat Invoice Bandwidth
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
          Invoice otomatis dari data bandwidth mitra
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Pilih Mitra */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              Mitra
            </label>
            <select
              value={tenantId}
              onChange={e => setTenantId(e.target.value)}
              style={{
                width: '100%', height: 38, padding: '0 12px', borderRadius: 9, fontSize: 13,
                background: 'var(--input-bg)', border: '1.5px solid var(--input-border)',
                color: 'var(--text-1)', fontFamily: 'inherit',
              }}
            >
              <option value="">Pilih mitra...</option>
              {bandwidthTenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {bandwidthTenants.length === 0 && (
              <p style={{ fontSize: 11, color: '#F59E0B', marginTop: 4 }}>
                Tidak ada mitra dengan bandwidth aktif
              </p>
            )}
          </div>

          {/* Periode */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
                Bulan
              </label>
              <select
                value={periodMonth}
                onChange={e => setPeriodMonth(Number(e.target.value))}
                style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 9, fontSize: 13, background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-1)', fontFamily: 'inherit' }}
              >
                {PERIOD_NAMES.slice(1).map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
                Tahun
              </label>
              <select
                value={periodYear}
                onChange={e => setPeriodYear(Number(e.target.value))}
                style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 9, fontSize: 13, background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-1)', fontFamily: 'inherit' }}
              >
                {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* PPN */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              PPN (%)
            </label>
            <input
              type="number" value={ppnPercent} min={0} max={100}
              onChange={e => setPpnPercent(Number(e.target.value))}
              style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 9, fontSize: 13, background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-1)', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          {/* Authorized */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
                Ditandatangani Oleh
              </label>
              <input
                type="text" placeholder="Nama penanda tangan" value={authorizedBy}
                onChange={e => setAuthorizedBy(e.target.value)}
                style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 9, fontSize: 13, background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-1)', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
                Jabatan
              </label>
              <input
                type="text" placeholder="Finance" value={authorizedTitle}
                onChange={e => setTitle(e.target.value)}
                style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 9, fontSize: 13, background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-1)', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Info Pembayaran */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              Info Pembayaran
            </label>
            <textarea
              placeholder="Pembayaran dapat dilakukan melalui transfer ke rekening..."
              value={payDesc} rows={2}
              onChange={e => setPayDesc(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 9, fontSize: 13, background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-1)', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>Batal</Button>
          <Button size="sm" loading={loading} onClick={handleCreate} icon={<Plus size={13} />}>
            Buat Invoice
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TenantInvoicesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const { data: invoices, isLoading } = useQuery<TenantInvoiceRow[]>({
    queryKey: ['tenant-invoices'],
    queryFn: () => api.get('/tenant-invoices').then(r => r.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/tenant-invoices/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant-invoices'] }); toast.success('Status diperbarui'); },
  });

  const downloadPdf = async (id: number, invoiceNumber: string) => {
    try {
      const res = await api.get(`/tenant-invoices/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch {
      toast.error('Gagal membuka PDF');
    }
  };

  return (
    <>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Invoice Mitra</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
              Tagihan bandwidth dan layanan untuk mitra
            </p>
          </div>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            Buat Invoice
          </Button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><Spinner size="lg" /></div>
        ) : !invoices?.length ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
            <FileText size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Belum ada invoice mitra</p>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)} style={{ marginTop: 16 }}>
              Buat Invoice Pertama
            </Button>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['No. Invoice', 'Mitra', 'Periode', 'Total', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <code style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--nav-active-text)', background: 'var(--nav-active-bg)', padding: '2px 8px', borderRadius: 6 }}>
                        {inv.invoiceNumber}
                      </code>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{inv.tenantName}</p>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                        {PERIOD_NAMES[inv.periodMonth]} {inv.periodYear}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                        {formatRp(inv.totalAmount)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={STATUS_VARIANT[inv.status]}>
                        {inv.status === 'draft' ? 'Draft' : inv.status === 'sent' ? 'Terkirim' : 'Lunas'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => downloadPdf(inv.id, inv.invoiceNumber)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12, color: 'var(--text-2)' }}
                        >
                          <Download size={12} /> PDF
                        </button>
                        {inv.status !== 'paid' && (
                          <button
                            onClick={() => updateStatus.mutate({
                              id: inv.id,
                              status: inv.status === 'draft' ? 'sent' : 'paid',
                            })}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12, color: inv.status === 'sent' ? '#10B981' : 'var(--text-2)' }}
                          >
                            <CheckCircle2 size={12} />
                            {inv.status === 'draft' ? 'Kirim' : 'Lunas'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateInvoiceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ['tenant-invoices'] })}
      />
    </>
  );
}