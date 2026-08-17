import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { SelectInput } from '@/components/ui/select-input';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAssignSubscription, useSubscriptionPlans } from '@/hooks/useSubscriptions';
import { useTenants } from '@/hooks/useTenants';

interface AssignDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AssignDialog({ open, onClose }: AssignDialogProps) {
  const { data: tenants } = useTenants();
  const { data: plans } = useSubscriptionPlans();
  const [form, setForm] = useState({
    tenantId: '', planId: '', durationMonths: '1', amountPaid: '', notes: '',
  });
  const assign = useAssignSubscription(() => {
    onClose();
    setForm({ tenantId: '', planId: '', durationMonths: '1', amountPaid: '', notes: '' });
  });

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
      title="Aktifkan Langganan"
      subtitle="Berikan akses paket ke mitra"
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={assign.isPending}>Batal</Button>
          <Button size="sm" loading={assign.isPending} onClick={handleSubmit as any}>Aktifkan</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SelectInput
          label="Mitra" value={form.tenantId} onChange={set('tenantId')}
          options={tenantOptions} placeholder="Pilih mitra..." required
        />

        <SelectInput
          label="Paket Langganan" value={form.planId} onChange={set('planId')}
          options={planOptions} placeholder="Pilih paket..." required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Dialog>
  );
}