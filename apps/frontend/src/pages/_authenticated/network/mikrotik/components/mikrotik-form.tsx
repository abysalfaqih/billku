import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCreateMikrotik, useUpdateMikrotik } from '@/hooks/useMikrotik';
import type { MikrotikConfig } from '@/types';

interface MikrotikFormProps {
  open: boolean;
  onClose: () => void;
  config?: MikrotikConfig | null;
}

const INIT = { name: '', host: '', port: '8728', username: '', password: '', radiusSecret: '' };

export function MikrotikForm({ open, onClose, config }: MikrotikFormProps) {
  const [form, setForm] = useState(INIT);
  const isEdit = !!config;
  const create = useCreateMikrotik(() => { onClose(); setForm(INIT); });
  const update = useUpdateMikrotik(() => { onClose(); setForm(INIT); });

  useEffect(() => {
    if (config) {
      setForm({
        name: config.name,
        host: config.host,
        port: String(config.port),
        username: config.username,
        password: '',
        radiusSecret: '',
      });
    } else {
      setForm(INIT);
    }
  }, [config, open]);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEdit && config) {
      const payload: Record<string, unknown> = {
        name: form.name,
        host: form.host,
        port: Number(form.port),
        username: form.username,
      };
      if (form.password) payload.password = form.password; // kosong = tidak diubah
      if (form.radiusSecret) payload.radiusSecret = form.radiusSecret; // kosong = tidak diubah
      update.mutate({ id: config.id, data: payload });
      return;
    }

    create.mutate({ ...form, port: Number(form.port) });
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Mikrotik' : 'Tambah Mikrotik'}
      subtitle={isEdit ? config?.name : 'Hubungkan router Mikrotik baru'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>Batal</Button>
          <Button size="sm" loading={isPending} onClick={handleSubmit as any}>
            {isEdit ? 'Simpan Perubahan' : 'Tambah Mikrotik'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input
          label="Nama Router" placeholder="contoh: Router Utama"
          value={form.name} onChange={set('name')} required
        />

        <div className="grid-2-1">
          <Input
            label="IP Address" placeholder="192.168.1.1"
            value={form.host} onChange={set('host')} required
          />
          <Input
            label="Port API" type="number" placeholder="8728"
            value={form.port} onChange={set('port')} required
          />
        </div>

        <Input
          label="Username" placeholder="admin"
          value={form.username} onChange={set('username')} required autoComplete="off"
        />
        <Input
          label={isEdit ? 'Password (opsional)' : 'Password'}
          type="password"
          placeholder={isEdit ? 'Kosongkan jika tidak diubah' : '••••••••'}
          value={form.password} onChange={set('password')} required={!isEdit} autoComplete="new-password"
        />

        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 12,
        }}>
          <Input
            label={isEdit ? 'RADIUS Secret (opsional)' : 'RADIUS Secret'}
            placeholder={isEdit ? 'Kosongkan jika tidak diubah' : 'secret yang dikonfigurasi di Mikrotik → RADIUS'}
            value={form.radiusSecret} onChange={set('radiusSecret')} required={!isEdit}
          />
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
            Secret ini harus sama dengan yang dikonfigurasi di menu RADIUS pada Mikrotik
          </p>
        </div>

        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Dialog>
  );
}