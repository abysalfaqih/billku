import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Download, CheckCircle2, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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

interface InvoiceItem {
  description: string;
  qty: number;
  unitPrice: number;
  discPercent: number;
  tax: 'P' | 'N';
}

interface TenantInvoiceDetail {
  id: number;
  tenantId: string;
  invoiceNumber: string;
  periodMonth: number;
  periodYear: number;
  items: InvoiceItem[];
  ppnPercent: string;
  discountAmount: string;
  paymentDescription: string | null;
  authorizedBy: string | null;
  authorizedTitle: string | null;
  notes: string | null;
  status: 'draft' | 'sent' | 'paid';
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

const fieldStyle: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px', borderRadius: 9, fontSize: 13,
  background: 'var(--input-bg)', border: '1.5px solid var(--input-border)',
  color: 'var(--text-1)', fontFamily: 'inherit', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6,
};

function calcTotals(items: InvoiceItem[], ppnPercent: number, discountAmount: number) {
  const subtotal = items.reduce((sum, it) => sum + (it.unitPrice * it.qty * (1 - it.discPercent / 100)), 0);
  const ppnAmount = Number(((subtotal * ppnPercent) / 100).toFixed(2));
  const totalAmount = subtotal - discountAmount + ppnAmount;
  return { subtotal, ppnAmount, totalAmount };
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
      position: 'fixed', inset: 0, zIndex: 200, padding: 16,
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box',
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
            <label style={labelStyle}>
              Mitra
            </label>
            <select
              value={tenantId}
              onChange={e => setTenantId(e.target.value)}
              style={fieldStyle}
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
              <label style={labelStyle}>
                Bulan
              </label>
              <select
                value={periodMonth}
                onChange={e => setPeriodMonth(Number(e.target.value))}
                style={fieldStyle}
              >
                {PERIOD_NAMES.slice(1).map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>
                Tahun
              </label>
              <select
                value={periodYear}
                onChange={e => setPeriodYear(Number(e.target.value))}
                style={fieldStyle}
              >
                {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* PPN */}
          <div>
            <label style={labelStyle}>
              PPN (%)
            </label>
            <input
              type="number" value={ppnPercent} min={0} max={100}
              onChange={e => setPpnPercent(Number(e.target.value))}
              style={fieldStyle}
            />
          </div>

          {/* Authorized */}
          <div className="grid-stats-2">
            <div>
              <label style={labelStyle}>
                Ditandatangani Oleh
              </label>
              <input
                type="text" placeholder="Nama penanda tangan" value={authorizedBy}
                onChange={e => setAuthorizedBy(e.target.value)}
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Jabatan
              </label>
              <input
                type="text" placeholder="Finance" value={authorizedTitle}
                onChange={e => setTitle(e.target.value)}
                style={fieldStyle}
              />
            </div>
          </div>

          {/* Info Pembayaran */}
          <div>
            <label style={labelStyle}>
              Info Pembayaran
            </label>
            <textarea
              placeholder="Pembayaran dapat dilakukan melalui transfer ke rekening..."
              value={payDesc} rows={2}
              onChange={e => setPayDesc(e.target.value)}
              style={{ ...fieldStyle, height: 'auto', padding: '8px 12px', resize: 'vertical' }}
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

function EditInvoiceDialog({
  invoiceId, onClose, onSaved,
}: {
  invoiceId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [periodMonth, setPeriodMonth]       = useState(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear]         = useState(new Date().getFullYear());
  const [items, setItems]                   = useState<InvoiceItem[]>([]);
  const [ppnPercent, setPpnPercent]         = useState(11);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [payDesc, setPayDesc]               = useState('');
  const [authorizedBy, setAuthorizedBy]     = useState('');
  const [authorizedTitle, setTitle]         = useState('');
  const [notes, setNotes]                   = useState('');
  const [status, setStatus]                 = useState<'draft' | 'sent' | 'paid'>('draft');
  const [saving, setSaving]                 = useState(false);

  const open = invoiceId !== null;

  const { data: detail, isLoading } = useQuery<TenantInvoiceDetail>({
    queryKey: ['tenant-invoice', invoiceId],
    queryFn: () => api.get(`/tenant-invoices/${invoiceId}`).then(r => r.data),
    enabled: open,
  });

  // Isi ulang form setiap kali data invoice yang dituju selesai dimuat
  useEffect(() => {
    if (!detail) return;
    setPeriodMonth(detail.periodMonth);
    setPeriodYear(detail.periodYear);
    setItems(detail.items.map(it => ({ ...it })));
    setPpnPercent(Number(detail.ppnPercent));
    setDiscountAmount(Number(detail.discountAmount));
    setPayDesc(detail.paymentDescription ?? '');
    setAuthorizedBy(detail.authorizedBy ?? '');
    setTitle(detail.authorizedTitle ?? '');
    setNotes(detail.notes ?? '');
    setStatus(detail.status);
  }, [detail]);

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    setItems(prev => [...prev, { description: '', qty: 1, unitPrice: 0, discPercent: 0, tax: 'P' }]);
  };

  const { subtotal, ppnAmount, totalAmount } = calcTotals(items, ppnPercent, discountAmount);

  const handleSave = async () => {
    if (items.length === 0) return toast.error('Invoice harus punya minimal 1 item');
    if (items.some(it => !it.description.trim())) return toast.error('Deskripsi item tidak boleh kosong');

    setSaving(true);
    try {
      await api.put(`/tenant-invoices/${invoiceId}`, {
        periodMonth, periodYear, items, ppnPercent, discountAmount,
        paymentDescription: payDesc, authorizedBy, authorizedTitle: authorizedTitle, notes, status,
      });
      toast.success('Invoice berhasil diperbarui');
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal memperbarui invoice'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, padding: 16,
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 640,
        maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
              Edit Invoice {detail?.invoiceNumber ?? ''}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              Perbarui periode, item, dan rincian invoice ini
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface-2)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {isLoading || !detail ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Spinner size="lg" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
            {/* Periode & status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Bulan</label>
                <select value={periodMonth} onChange={e => setPeriodMonth(Number(e.target.value))} style={fieldStyle}>
                  {PERIOD_NAMES.slice(1).map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tahun</label>
                <input
                  type="number" value={periodYear}
                  onChange={e => setPeriodYear(Number(e.target.value))}
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as any)} style={fieldStyle}>
                  <option value="draft">Draft</option>
                  <option value="sent">Terkirim</option>
                  <option value="paid">Lunas</option>
                </select>
              </div>
            </div>

            {/* Items */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Item Invoice</label>
                <Button variant="outline" size="xs" icon={<Plus size={11} />} onClick={addItem}>
                  Tambah Item
                </Button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 6, padding: 10,
                      borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text" placeholder="Deskripsi item" value={it.description}
                        onChange={e => updateItem(idx, { description: e.target.value })}
                        style={{ ...fieldStyle, flex: 1 }}
                      />
                      <button
                        onClick={() => removeItem(idx)}
                        title="Hapus item"
                        style={{
                          width: 38, height: 38, borderRadius: 9, border: '1px solid var(--border)',
                          background: 'var(--surface)', cursor: 'pointer', color: '#EF4444',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                      <input
                        type="number" min={1} placeholder="Qty" value={it.qty}
                        onChange={e => updateItem(idx, { qty: Number(e.target.value) })}
                        style={fieldStyle}
                      />
                      <input
                        type="number" min={0} placeholder="Harga satuan" value={it.unitPrice}
                        onChange={e => updateItem(idx, { unitPrice: Number(e.target.value) })}
                        style={fieldStyle}
                      />
                      <input
                        type="number" min={0} max={100} placeholder="Disc %" value={it.discPercent}
                        onChange={e => updateItem(idx, { discPercent: Number(e.target.value) })}
                        style={fieldStyle}
                      />
                      <select
                        value={it.tax}
                        onChange={e => updateItem(idx, { tax: e.target.value as 'P' | 'N' })}
                        style={fieldStyle}
                      >
                        <option value="P">Kena PPN</option>
                        <option value="N">Non-PPN</option>
                      </select>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>
                    Belum ada item. Tambahkan minimal 1 item.
                  </p>
                )}
              </div>
            </div>

            {/* PPN & diskon */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>PPN (%)</label>
                <input
                  type="number" min={0} max={100} value={ppnPercent}
                  onChange={e => setPpnPercent(Number(e.target.value))}
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Diskon (Rp)</label>
                <input
                  type="number" min={0} value={discountAmount}
                  onChange={e => setDiscountAmount(Number(e.target.value))}
                  style={fieldStyle}
                />
              </div>
            </div>

            {/* Authorized */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Ditandatangani Oleh</label>
                <input
                  type="text" placeholder="Nama penanda tangan" value={authorizedBy}
                  onChange={e => setAuthorizedBy(e.target.value)}
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Jabatan</label>
                <input
                  type="text" placeholder="Finance" value={authorizedTitle}
                  onChange={e => setTitle(e.target.value)}
                  style={fieldStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Info Pembayaran</label>
              <textarea
                placeholder="Pembayaran dapat dilakukan melalui transfer ke rekening..."
                value={payDesc} rows={2}
                onChange={e => setPayDesc(e.target.value)}
                style={{ ...fieldStyle, height: 'auto', padding: '8px 12px', resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Catatan (opsional)</label>
              <textarea
                placeholder="Catatan internal..."
                value={notes} rows={2}
                onChange={e => setNotes(e.target.value)}
                style={{ ...fieldStyle, height: 'auto', padding: '8px 12px', resize: 'vertical' }}
              />
            </div>

            {/* Ringkasan total */}
            <div style={{
              padding: 12, borderRadius: 10, background: 'var(--surface-2)',
              border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)' }}>
                <span>Subtotal</span><span>{formatRp(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)' }}>
                <span>Diskon</span><span>-{formatRp(discountAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)' }}>
                <span>PPN ({ppnPercent}%)</span><span>{formatRp(ppnAmount)}</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700,
                color: 'var(--text-1)', marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border)',
              }}>
                <span>Total</span><span>{formatRp(totalAmount)}</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Batal</Button>
          <Button size="sm" loading={saving} onClick={handleSave} disabled={isLoading || !detail}>
            Simpan Perubahan
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TenantInvoicesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TenantInvoiceRow | null>(null);
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

  const deleteInvoice = useMutation({
    mutationFn: (id: number) => api.delete(`/tenant-invoices/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-invoices'] });
      toast.success('Invoice berhasil dihapus');
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Gagal menghapus invoice'));
    },
  });

  const downloadPdf = async (id: number) => {
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
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
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
          <div style={{
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          }}>
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
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
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => downloadPdf(inv.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12, color: 'var(--text-2)' }}
                        >
                          <Download size={12} /> PDF
                        </button>
                        <button
                          onClick={() => setEditId(inv.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12, color: 'var(--text-2)' }}
                        >
                          <Pencil size={12} /> Edit
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
                        <button
                          onClick={() => setDeleteTarget(inv)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12, color: '#EF4444' }}
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
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

      <EditInvoiceDialog
        invoiceId={editId}
        onClose={() => setEditId(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['tenant-invoices'] })}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteInvoice.mutate(deleteTarget.id); }}
        loading={deleteInvoice.isPending}
        title="Hapus Invoice Ini?"
        description={`Invoice "${deleteTarget?.invoiceNumber}" untuk mitra "${deleteTarget?.tenantName}" akan dihapus permanen dan tidak bisa dikembalikan.`}
        confirmLabel="Hapus"
      />
    </>
  );
}
