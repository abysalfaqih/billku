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

const INIT = { provider: 'fonnte', name: '', apiKey: '', senderNumber: '', phoneNumberId: '', domain: '' };

const PROVIDER_INFO: Record<string, { label: string; hint: string }> = {
  fonnte: { label: 'Fonnte', hint: 'API Key dari dashboard Fonnte Anda' },
  wablast: { label: 'WA Blast', hint: 'Token dari dashboard WA Blast (menu Device - Settings) — tempel apa adanya, satu kotak saja' },
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
    if (form.provider === 'wablast' && form.domain) {
      payload.extraConfig = JSON.stringify({ domain: form.domain });
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
          <Input
            label="Domain API" placeholder="https://solo.wablas.com"
            value={form.domain} onChange={set('domain')} required
            hint="Domain akun WA Blast Anda, tempel apa adanya (terlihat di URL saat login ke dashboard)"
          />
        )}

        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Dialog>
  );
}