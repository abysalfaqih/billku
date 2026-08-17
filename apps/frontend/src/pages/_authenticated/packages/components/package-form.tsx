import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SelectInput } from '@/components/ui/select-input';
import { Button } from '@/components/ui/button';
import { useCreatePackage, useUpdatePackage } from '@/hooks/usePackages';
import { useIpPools } from '@/hooks/useIpPools';
import type { Package } from '@/types';

interface PackageFormProps {
  open: boolean;
  onClose: () => void;
  pkg?: Package | null;
}

const INIT = { name: '', description: '', speedDownload: '', speedUpload: '', price: '', ipPoolId: '' };

export function PackageForm({ open, onClose, pkg }: PackageFormProps) {
  const [form, setForm] = useState(INIT);
  const isEdit = !!pkg;
  const create = useCreatePackage(onClose);
  const update = useUpdatePackage(onClose);
  const { data: ipPools } = useIpPools();

  useEffect(() => {
    if (pkg) {
      setForm({
        name: pkg.name,
        description: pkg.description ?? '',
        speedDownload: String(pkg.speedDownload),
        speedUpload: String(pkg.speedUpload),
        price: String(Number(pkg.price)),
        ipPoolId: pkg.ipPoolId ? String(pkg.ipPoolId) : '',
      });
    } else {
      setForm(INIT);
    }
  }, [pkg, open]);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description || undefined,
      speedDownload: Number(form.speedDownload),
      speedUpload: Number(form.speedUpload),
      price: Number(form.price),
    };
    if (form.ipPoolId) payload.ipPoolId = Number(form.ipPoolId);

    if (isEdit && pkg) update.mutate({ id: pkg.id, data: payload });
    else create.mutate(payload);
  };

  const isPending = create.isPending || update.isPending;
  const poolOptions = (ipPools ?? []).map((p) => ({ value: p.id, label: p.displayName }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Paket' : 'Tambah Paket'}
      subtitle={isEdit ? pkg?.name : 'Konfigurasi paket internet baru'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>Batal</Button>
          <Button size="sm" loading={isPending} onClick={handleSubmit as any}>
            {isEdit ? 'Simpan' : 'Tambah Paket'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input
          label="Nama Paket" placeholder="contoh: Paket 10 Mbps"
          value={form.name} onChange={set('name')} required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="Kecepatan Download (Mbps)" type="number" min="1"
            placeholder="10" value={form.speedDownload} onChange={set('speedDownload')} required
          />
          <Input
            label="Kecepatan Upload (Mbps)" type="number" min="1"
            placeholder="5" value={form.speedUpload} onChange={set('speedUpload')} required
          />
        </div>

        <Input
          label="Harga (Rp)" type="number" min="1000"
          placeholder="150000" value={form.price} onChange={set('price')} required
        />

        <SelectInput
          label="IP Pool" value={form.ipPoolId} onChange={set('ipPoolId')}
          options={poolOptions} placeholder="Pilih IP Pool..."
          hint={!poolOptions.length ? 'Belum ada IP Pool — buat dulu di menu Jaringan' : 'Menentukan rate limit & jaringan pelanggan'}
        />

        <Textarea
          label="Deskripsi (opsional)" placeholder="Keterangan paket..."
          value={form.description} onChange={set('description')} rows={3}
        />

        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Dialog>
  );
}