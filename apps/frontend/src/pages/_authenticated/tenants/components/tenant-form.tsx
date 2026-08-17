import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useCreateTenant } from '@/hooks/useTenants';
import { Switch } from '@/components/ui/switch';

interface TenantFormProps {
  open: boolean;
  onClose: () => void;
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

export function TenantForm({ open, onClose }: TenantFormProps) {
  const [form, setForm] = useState(INIT);
  const create = useCreateTenant(() => { onClose(); setForm(INIT); });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((p) => ({
        ...p,
        [k]: value,
        // Auto-generate slug dari nama
        ...(k === 'name' ? {
          slug: value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        } : {}),
      }));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(form);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tambah Mitra Baru"
      subtitle="Daftarkan perusahaan/mitra baru ke sistem"
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={create.isPending}>Batal</Button>
          <Button size="sm" loading={create.isPending} onClick={handleSubmit as any}>Tambah Mitra</Button>
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
          hint="Dipakai mitra untuk login. Otomatis dari nama, bisa diubah."
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