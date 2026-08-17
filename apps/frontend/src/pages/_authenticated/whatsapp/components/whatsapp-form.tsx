import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SelectInput } from '@/components/ui/select-input';
import { Button } from '@/components/ui/button';
import { useCreateWhatsappConfig } from '@/hooks/useWhatsapp';

interface WhatsappFormProps {
  open: boolean;
  onClose: () => void;
}

const INIT = { provider: 'fonnte', name: '', apiKey: '', senderNumber: '', phoneNumberId: '', secretKey: '', server: '' };

const PROVIDER_INFO: Record<string, { label: string; hint: string }> = {
  fonnte: { label: 'Fonnte', hint: 'API Key dari dashboard Fonnte Anda' },
  wablast: { label: 'WA Blast', hint: 'Token dari dashboard WA Blast (menu Device - Settings)' },
  meta: { label: 'WhatsApp Business API (Meta)', hint: 'Access Token dari Meta for Developers' },
};

export function WhatsappForm({ open, onClose }: WhatsappFormProps) {
  const [form, setForm] = useState(INIT);
  const create = useCreateWhatsappConfig(() => { onClose(); setForm(INIT); });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      provider: form.provider,
      name: form.name,
      apiKey: form.apiKey,
      senderNumber: form.senderNumber,
    };
    if (form.provider === 'meta' && form.phoneNumberId) {
      payload.extraConfig = JSON.stringify({ phone_number_id: form.phoneNumberId });
    }
    if (form.provider === 'wablast' && form.secretKey && form.server) {
      payload.extraConfig = JSON.stringify({ secret_key: form.secretKey, server: form.server });
    }
    create.mutate(payload);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tambah Konfigurasi WhatsApp"
      subtitle="Hubungkan provider WhatsApp untuk notifikasi"
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={create.isPending}>Batal</Button>
          <Button size="sm" loading={create.isPending} onClick={handleSubmit as any}>Simpan</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SelectInput
          label="Provider" value={form.provider} onChange={set('provider')}
          options={[
            { value: 'fonnte', label: 'Fonnte' },
            { value: 'wablast', label: 'WA Blast' },
            { value: 'meta', label: 'WhatsApp Business API (Meta)' },
          ]}
          required
        />

        <Input
          label="Nama Konfigurasi" placeholder="contoh: WA Utama"
          value={form.name} onChange={set('name')} required
        />

        <Input
          label={form.provider === 'meta' ? 'Access Token' : 'API Key'}
          placeholder="••••••••••••••••"
          value={form.apiKey} onChange={set('apiKey')} required
          hint={PROVIDER_INFO[form.provider]?.hint}
        />

        <Input
          label="Nomor Pengirim" placeholder="628123456789"
          value={form.senderNumber} onChange={set('senderNumber')} required
        />

        {form.provider === 'meta' && (
          <Input
            label="Phone Number ID" placeholder="dari Meta for Developers"
            value={form.phoneNumberId} onChange={set('phoneNumberId')} required
          />
        )}

        {form.provider === 'wablast' && (
          <>
            <Input
              label="Secret Key" placeholder="••••••••••••••••"
              value={form.secretKey} onChange={set('secretKey')} required
              hint="Digenerate di menu Device - Settings pada dashboard WA Blast"
            />
            <Input
              label="Server" placeholder="contoh: solo, kudus, jogja"
              value={form.server} onChange={set('server')} required
              hint="Nama server/subdomain akun Anda, terlihat di URL saat login ke WA Blast"
            />
          </>
        )}

        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Dialog>
  );
}