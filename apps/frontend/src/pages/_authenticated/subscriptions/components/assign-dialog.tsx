import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { SelectInput } from '@/components/ui/select-input';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAssignSubscription, useSubscriptionPlans } from '@/hooks/useSubscriptions';
import { useTenants } from '@/hooks/useTenants';

export interface AssignDialogPreset {
  tenantId: string;
  tenantName: string;
  planId?: number | null;
  durationMonths?: number | null;
  amountPaid?: string | null;
}

interface AssignDialogProps {
  open: boolean;
  onClose: () => void;
  // Kalau diisi, dialog terbuka dalam mode "Ganti Paket" untuk satu mitra
  // tertentu — pilihan mitra otomatis terkunci ke mitra tersebut supaya tidak
  // salah pilih, dan form diisi awal dari langganannya yang sedang berjalan.
  preset?: AssignDialogPreset | null;
}

const EMPTY_FORM = { tenantId: '', planId: '', durationMonths: '1', amountPaid: '', notes: '' };

export function AssignDialog({ open, onClose, preset }: AssignDialogProps) {
  const { data: tenants } = useTenants();
  const { data: plans } = useSubscriptionPlans();
  const [form, setForm] = useState(EMPTY_FORM);
  const isChangePlan = !!preset;

  const assign = useAssignSubscription(() => {
    onClose();
    setForm(EMPTY_FORM);
  });

  // Setiap dialog dibuka: isi dari preset (mode ganti paket) atau kosongkan (mode bebas pilih mitra).
  useEffect(() => {
    if (!open) return;
    if (preset) {
      setForm({
        tenantId: preset.tenantId,
        planId: preset.planId ? String(preset.planId) : '',
        durationMonths: preset.durationMonths ? String(preset.durationMonths) : '1',
        amountPaid: preset.amountPaid ? String(Number(preset.amountPaid)) : '',
        notes: '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, preset]);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    assign.mutate({
      tenantId: form.tenantId,
      planId: Number(form.planId),
      status: 'active',
      durationMonths: Number(form.durationMonths),
      amountPaid: Number(form.amountPaid) || 0,
      notes: form.notes || undefined,
    });
  };

  const tenantOptions = (tenants ?? []).map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` }));
  const planOptions = (plans ?? []).map((p) => ({
    value: p.id,
    label: `${p.name} — Rp ${Number(p.priceMonthly).toLocaleString('id-ID')}/bulan`,
  }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isChangePlan ? 'Ganti Paket Mitra' : 'Aktifkan Langganan'}
      subtitle={isChangePlan
        ? `Perbarui paket langganan untuk ${preset?.tenantName}`
        : 'Berikan akses paket ke mitra'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={assign.isPending}>Batal</Button>
          <Button size="sm" loading={assign.isPending} onClick={handleSubmit as any}>
            {isChangePlan ? 'Ganti Paket' : 'Aktifkan'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {isChangePlan ? (
          <Input label="Mitra" value={preset?.tenantName ?? ''} disabled readOnly />
        ) : (
          <SelectInput
            label="Mitra" value={form.tenantId} onChange={set('tenantId')}
            options={tenantOptions} placeholder="Pilih mitra..." required
          />
        )}

        <SelectInput
          label="Paket Langganan" value={form.planId} onChange={set('planId')}
          options={planOptions} placeholder="Pilih paket..." required
        />

        <div className="grid-stats-2">
          <Input
            label="Durasi (bulan)" type="number" min="1" placeholder="1"
            value={form.durationMonths} onChange={set('durationMonths')} required
          />
          <Input
            label="Jumlah Dibayar (Rp)" type="number" min="0" placeholder="300000"
            value={form.amountPaid} onChange={set('amountPaid')}
          />
        </div>

        <Input
          label="Catatan (opsional)" placeholder="contoh: bayar via transfer"
          value={form.notes} onChange={set('notes')}
        />

        {isChangePlan && (
          <p style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Langganan yang sedang aktif akan otomatis ditandai "Dibatalkan" dan digantikan
            langganan baru ini — riwayat langganan sebelumnya tetap tersimpan.
          </p>
        )}

        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Dialog>
  );
}
