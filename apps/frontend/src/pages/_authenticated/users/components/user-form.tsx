import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SelectInput } from '@/components/ui/select-input';
import { Button } from '@/components/ui/button';
import { useCreateUser, useUpdateUser } from '@/hooks/useUsers';
import type { UserRow } from '@/hooks/useUsers';

interface UserFormProps {
  open: boolean;
  onClose: () => void;
  tenantId?: string;
  user?: UserRow | null;
}

const INIT = { name: '', email: '', password: '', role: 'staff' };

export function UserForm({ open, onClose, tenantId, user }: UserFormProps) {
  const [form, setForm] = useState(INIT);
  const isEdit = !!user;
  const create = useCreateUser(() => { onClose(); setForm(INIT); });
  const update = useUpdateUser(tenantId, () => { onClose(); setForm(INIT); });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role === 'super_admin' ? 'admin' : user.role,
      });
    } else {
      setForm(INIT);
    }
  }, [user, open]);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEdit && user) {
      const payload: Record<string, unknown> = { name: form.name, email: form.email, role: form.role };
      if (form.password) payload.password = form.password; // kosong = password tidak diubah
      update.mutate({ id: user.id, data: payload });
      return;
    }

    const payload: Record<string, unknown> = { ...form };
    if (tenantId) payload.tenantId = tenantId;
    create.mutate(payload);
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Pengguna' : 'Tambah Pengguna'}
      subtitle={isEdit ? user?.email : (tenantId ? 'Buat akun admin/staff untuk mitra ini' : 'Tambah admin/staff ke tim Anda')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>Batal</Button>
          <Button size="sm" loading={isPending} onClick={handleSubmit as any}>
            {isEdit ? 'Simpan Perubahan' : 'Tambah'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Nama Lengkap" placeholder="Budi Santoso" value={form.name} onChange={set('name')} required />
        <Input label="Email" type="email" placeholder="budi@example.com" value={form.email} onChange={set('email')} required />
        <Input
          label={isEdit ? 'Password Baru (opsional)' : 'Password'}
          type="password"
          placeholder={isEdit ? 'Kosongkan jika tidak diubah' : 'Minimal 6 karakter'}
          value={form.password}
          onChange={set('password')}
          required={!isEdit}
          minLength={6}
        />
        <SelectInput
          label="Role" value={form.role} onChange={set('role')}
          options={[
            { value: 'admin', label: 'Admin — akses penuh' },
            { value: 'staff', label: 'Staff — akses terbatas' },
          ]}
        />
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Dialog>
  );
}