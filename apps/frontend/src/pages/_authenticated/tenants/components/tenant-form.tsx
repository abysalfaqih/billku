import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useCreateTenant, useUpdateTenant } from '@/hooks/useTenants';
import { Switch } from '@/components/ui/switch';
import type { Tenant } from '@/types';

interface TenantFormProps {
  open: boolean;
  onClose: () => void;
  // Kalau diisi → dialog jadi mode edit mitra ini. Kalau null/undefined → mode tambah mitra baru.
  tenant?: Tenant | null;
}

const INIT = {
  name: '',
  slug: '',
  email: '',
  phone: '',
  address: '',
  bandwidthEnabled: false,
  bandwidthDescription: '',
  bandwidthPriceMonthly: '',
};

function tenantToForm(t: Tenant): typeof INIT {
  return {
    name: t.name,
    slug: t.slug,
    email: t.email,
    phone: t.phone,
    address: t.address ?? '',
    bandwidthEnabled: t.bandwidthEnabled,
    bandwidthDescription: t.bandwidthDescription ?? '',
    bandwidthPriceMonthly: t.bandwidthPriceMonthly ?? '',
  };
}

export function TenantForm({ open, onClose, tenant }: TenantFormProps) {
  const isEdit = !!tenant;
  const [form, setForm] = useState(INIT);

  // Setiap dialog dibuka, isi ulang form: dari data mitra (mode edit) atau kosong (mode tambah).
  useEffect(() => {
    if (!open) return;
    setForm(tenant ? tenantToForm(tenant) : INIT);
  }, [open, tenant]);

  const create = useCreateTenant(() => { onClose(); setForm(INIT); });
  const update = useUpdateTenant(() => { onClose(); });

  const isPending = create.isPending || update.isPending;

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((p) => ({
        ...p,
        [k]: value,
        // Auto-generate slug dari nama — hanya saat menambah mitra baru.
        // Saat edit, slug dibiarkan sesuai isian admin supaya kode login
        // mitra yang sudah dipakai tidak berubah tiba-tiba tanpa disengaja.
        ...(k === 'name' && !isEdit ? {
          slug: value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        } : {}),
      }));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && tenant) {
      update.mutate({ id: tenant.id, data: form });
    } else {
      create.mutate(form);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Mitra' : 'Tambah Mitra Baru'}
      subtitle={isEdit ? 'Perbarui data perusahaan/mitra ini' : 'Daftarkan perusahaan/mitra baru ke sistem'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>Batal</Button>
          <Button size="sm" loading={isPending} onClick={handleSubmit as any}>
            {isEdit ? 'Simpan Perubahan' : 'Tambah Mitra'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input
          label="Nama Perusahaan/Mitra" placeholder="contoh: Net Hotspot Sejahtera"
          value={form.name} onChange={set('name')} required
        />

        <Input
          label="Kode Mitra (Slug)" placeholder="net-hotspot-sejahtera"
          value={form.slug} onChange={set('slug')} required
          hint={isEdit
            ? 'Dipakai mitra untuk login. Hati-hati mengubah ini — mitra harus pakai kode baru saat login berikutnya.'
            : 'Dipakai mitra untuk login. Otomatis dari nama, bisa diubah.'}
        />

        <Input
          label="Email" type="email" placeholder="admin@nethotspot.com"
          value={form.email} onChange={set('email')} required
        />

        <Input
          label="No. Telepon" placeholder="081234567890"
          value={form.phone} onChange={set('phone')} required
        />

        <Textarea
          label="Alamat (opsional)" placeholder="Alamat kantor..."
          value={form.address} onChange={set('address')} rows={3}
        />

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <Switch
            label="Bandwidth Aktif"
            description="Mitra ini dikenakan biaya bandwidth bulanan"
            checked={!!form.bandwidthEnabled}
            onChange={(v) => setForm((p) => ({ ...p, bandwidthEnabled: v }))}
          />

          {form.bandwidthEnabled && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Input
                label="Deskripsi Bandwidth"
                placeholder="contoh: Metro 10Gbps"
                value={String(form.bandwidthDescription)}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    bandwidthDescription: e.target.value,
                  }))
                }
              />

              <Input
                label="Harga / Bulan (Rp)"
                type="number"
                placeholder="35000000"
                value={String(form.bandwidthPriceMonthly)}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    bandwidthPriceMonthly: e.target.value,
                  }))
                }
              />
            </div>
          )}
        </div>

        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Dialog>
  );
}
