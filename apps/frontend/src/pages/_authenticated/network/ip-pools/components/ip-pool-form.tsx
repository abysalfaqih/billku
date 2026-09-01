import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SelectInput } from '@/components/ui/select-input';
import { Button } from '@/components/ui/button';
import { useCreateIpPool } from '@/hooks/useIpPools';
import { useMikrotikConfigs } from '@/hooks/useMikrotik';

interface IpPoolFormProps {
  open: boolean;
  onClose: () => void;
}

const INIT = {
  mikrotikConfigId: '', displayName: '', name: '', network: '',
  dnsPrimary: '8.8.8.8', dnsSecondary: '8.8.4.4',
};

export function IpPoolForm({ open, onClose }: IpPoolFormProps) {
  const [form, setForm] = useState(INIT);
  const { data: mikrotikConfigs } = useMikrotikConfigs();
  const create = useCreateIpPool(() => { onClose(); setForm(INIT); });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({ ...form, mikrotikConfigId: Number(form.mikrotikConfigId) });
  };

  const mikrotikOptions = (mikrotikConfigs ?? []).map((m) => ({
    value: m.id, label: `${m.name} (${m.host})`,
  }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tambah IP Pool"
      subtitle="Akan otomatis dibuat di Mikrotik & FreeRADIUS"
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={create.isPending}>Batal</Button>
          <Button size="sm" loading={create.isPending} onClick={handleSubmit as any}>Buat IP Pool</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SelectInput
          label="Mikrotik" value={form.mikrotikConfigId} onChange={set('mikrotikConfigId')}
          options={mikrotikOptions} placeholder="Pilih router..." required
        />

        <Input
          label="Nama Tampilan" placeholder="contoh: Pool Basic 10 Mbps"
          value={form.displayName} onChange={set('displayName')} required
        />

        <Input
          label="Nama Teknis (slug)" placeholder="basic-10-mbps"
          value={form.name} onChange={set('name')} required
          hint="Huruf kecil, angka, strip saja. Dipakai di Mikrotik & FreeRADIUS"
        />

        <Input
          label="Network (CIDR)" placeholder="192.168.10.0/24"
          value={form.network} onChange={set('network')} required
          hint="Gateway dan range IP akan dihitung otomatis"
        />

        <div className="grid-stats-2">
          <Input
            label="DNS Primary" value={form.dnsPrimary} onChange={set('dnsPrimary')}
          />
          <Input
            label="DNS Secondary" value={form.dnsSecondary} onChange={set('dnsSecondary')}
          />
        </div>

        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Dialog>
  );
}