import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { LimitInput } from '@/components/ui/limit-input';
import { useCreatePlan, useUpdatePlan } from '@/hooks/useSubscriptions';
import type { SubscriptionPlan } from '@/types';

interface PlanFormProps {
  open: boolean;
  onClose: () => void;
  plan?: SubscriptionPlan | null;
}

const INIT = {
  name: '', description: '', priceMonthly: '',
  maxCustomers: 100, maxMikrotik: 1, maxIpPools: 5, maxUsers: 2,
  hasWhatsapp: false, hasApiAccess: false, hasReports: true,
};

function Section({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
      color: 'var(--text-3)', marginTop: 20, marginBottom: 10,
      paddingBottom: 8, borderBottom: '1px solid var(--border)',
    }}>
      {title}
    </div>
  );
}

export function PlanForm({ open, onClose, plan }: PlanFormProps) {
  const [form, setForm] = useState(INIT);
  const isEdit = !!plan;
  const create = useCreatePlan(onClose);
  const update = useUpdatePlan(onClose);

  useEffect(() => {
    if (plan) {
      setForm({
        name: plan.name,
        description: plan.description ?? '',
        priceMonthly: String(Number(plan.priceMonthly)),
        maxCustomers: plan.maxCustomers,
        maxMikrotik: plan.maxMikrotik,
        maxIpPools: plan.maxIpPools,
        maxUsers: plan.maxUsers,
        hasWhatsapp: plan.hasWhatsapp,
        hasApiAccess: plan.hasApiAccess,
        hasReports: plan.hasReports,
      });
    } else {
      setForm(INIT);
    }
  }, [plan, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      priceMonthly: Number(form.priceMonthly),
      description: form.description || undefined,
    };
    if (isEdit && plan) update.mutate({ id: plan.id, data: payload });
    else create.mutate(payload);
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Paket Langganan' : 'Buat Paket Langganan Baru'}
      subtitle={isEdit ? plan?.name : 'Atur harga, limit, dan fitur'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>Batal</Button>
          <Button size="sm" loading={isPending} onClick={handleSubmit as any}>
            {isEdit ? 'Simpan Perubahan' : 'Buat Paket'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input
          label="Nama Paket" placeholder="contoh: Gold"
          value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          required
        />

        <Input
          label="Harga / Bulan (Rp)" type="number" min="0" placeholder="300000"
          value={form.priceMonthly}
          onChange={(e) => setForm((p) => ({ ...p, priceMonthly: e.target.value }))}
          required
        />

        <Textarea
          label="Deskripsi (opsional)" placeholder="Cocok untuk mitra menengah..."
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          rows={2}
        />

        <Section title="Batas Penggunaan" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <LimitInput
            label="Maks. Pelanggan"
            value={form.maxCustomers}
            onChange={(v) => setForm((p) => ({ ...p, maxCustomers: v }))}
          />
          <LimitInput
            label="Maks. Mikrotik"
            value={form.maxMikrotik}
            onChange={(v) => setForm((p) => ({ ...p, maxMikrotik: v }))}
          />
          <LimitInput
            label="Maks. IP Pool"
            value={form.maxIpPools}
            onChange={(v) => setForm((p) => ({ ...p, maxIpPools: v }))}
          />
          <LimitInput
            label="Maks. User Admin"
            value={form.maxUsers}
            onChange={(v) => setForm((p) => ({ ...p, maxUsers: v }))}
          />
        </div>

        <Section title="Fitur" />

        <Switch
          label="Notifikasi WhatsApp"
          description="4 trigger otomatis: registrasi, reminder, isolir, lunas"
          checked={form.hasWhatsapp}
          onChange={(v) => setForm((p) => ({ ...p, hasWhatsapp: v }))}
        />
        <Switch
          label="Laporan & Statistik"
          description="Halaman laporan pendapatan dan statistik"
          checked={form.hasReports}
          onChange={(v) => setForm((p) => ({ ...p, hasReports: v }))}
        />
        <Switch
          label="Akses API"
          description="Integrasi via API untuk kebutuhan custom"
          checked={form.hasApiAccess}
          onChange={(v) => setForm((p) => ({ ...p, hasApiAccess: v }))}
        />
        
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Dialog>
  );
}