import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { SelectInput } from '@/components/ui/select-input';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUpdateTenantSubscription } from '@/hooks/useSubscriptions';
import { useSubscriptionPlans } from '@/hooks/useSubscriptions';
import type { TenantSubscriptionRow } from '@/types';

interface EditSubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
  row: TenantSubscriptionRow | null;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'trial', label: 'Trial' },
  { value: 'expired', label: 'Kadaluarsa' },
  { value: 'cancelled', label: 'Dibatalkan' },
];

// Untuk mengoreksi kesalahan input pada record langganan yang sudah ada
// (mis. salah pilih paket/durasi/nominal saat dicatat, atau status perlu
// diperbaiki) — TANPA membuat baris riwayat baru. Untuk pergantian paket yang
// sesungguhnya (mitra resmi upgrade/downgrade), gunakan tombol "Ganti Paket".
export function EditSubscriptionDialog({ open, onClose, row }: EditSubscriptionDialogProps) {
  const { data: plans } = useSubscriptionPlans();
  const [form, setForm] = useState({ planId: '', status: 'active', durationMonths: '1', amountPaid: '', notes: '' });

  const update = useUpdateTenantSubscription(() => onClose());

  useEffect(() => {
    if (!open || !row) return;
    setForm({
      planId: row.planId ? String(row.planId) : '',
      status: row.status ?? 'active',
      durationMonths: row.durationMonths ? String(row.durationMonths) : '1',
      amountPaid: row.amountPaid ? String(Number(row.amountPaid)) : '',
      notes: '',
    });
  }, [open, row]);

  if (!row || !row.subscriptionId) return null;

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {
      planId: Number(form.planId),
      status: form.status,
      durationMonths: Number(form.durationMonths),
      amountPaid: Number(form.amountPaid) || 0,
    };
    if (form.notes) data.notes = form.notes;
    update.mutate({ id: row.subscriptionId as number, data });
  };

  const planOptions = (plans ?? []).map((p) => ({ value: p.id, label: p.name }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Koreksi Data Langganan"
      subtitle={`${row.tenantName} — ubah tanpa membuat riwayat baru`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={update.isPending}>Batal</Button>
          <Button size="sm" loading={update.isPending} onClick={handleSubmit as any}>Simpan</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SelectInput
          label="Paket" value={form.planId} onChange={set('planId')}
          options={planOptions} placeholder="Pilih paket..." required
        />
        <SelectInput
          label="Status" value={form.status} onChange={set('status')}
          options={STATUS_OPTIONS} required
        />
        <div className="grid-stats-2">
          <Input
            label="Durasi (bulan)" type="number" min="1"
            value={form.durationMonths} onChange={set('durationMonths')} required
          />
          <Input
            label="Jumlah Dibayar (Rp)" type="number" min="0"
            value={form.amountPaid} onChange={set('amountPaid')}
          />
        </div>
        <Input
          label="Catatan (opsional)" placeholder="Alasan koreksi..."
          value={form.notes} onChange={set('notes')}
        />
        <p style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Perubahan ini langsung menimpa record langganan yang sedang dipilih (tidak membuat
          baris riwayat baru). Tanggal mulai langganan tidak berubah — hanya tanggal berakhir
          yang dihitung ulang jika durasi diubah.
        </p>
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Dialog>
  );
}
