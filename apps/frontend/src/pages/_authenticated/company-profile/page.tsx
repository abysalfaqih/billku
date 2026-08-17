import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Building2, ImageUp, RefreshCw, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTenantProfile, useUpdateTenantProfile } from '@/hooks/useTenantProfile';
import { useUploadLogo, useUploadFavicon } from '@/hooks/useTenantProfile';
import api from '@/lib/api';
import type { BankAccount } from '@/types';

function useSyncRadius() {
  return useMutation({
    mutationFn: () => api.post('/customers/sync-radius-all').then((r) => r.data),
    onSuccess: (data) => {
      toast.success(data.message ?? 'Sync RADIUS selesai');
    },
    onError: () => toast.error('Gagal sync RADIUS'),
  });
}

function RadiusSyncTool() {
  const sync = useSyncRadius();
  const [result, setResult] = useState<any>(null);

  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <ShieldCheck size={14} style={{ color: 'var(--nav-active-icon)' }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Bulk RADIUS Sync</p>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Sync semua pelanggan PPPoE ke RADIUS.
          </p>
          {result && (
            <div style={{
              marginTop: 8, padding: '8px 10px', borderRadius: 8, fontSize: 12,
              background: result.errors > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
              color: result.errors > 0 ? '#DC2626' : '#059669',
            }}>
              ✅ Synced: {result.synced} &nbsp;|&nbsp;
              ⏭ Skipped: {result.skipped} &nbsp;|&nbsp;
              ❌ Errors: {result.errors}
            </div>
          )}
        </div>
        <Button
          type="button" variant="outline" size="sm"
          icon={<RefreshCw size={13} />}
          loading={sync.isPending}
          onClick={() => sync.mutate(undefined, { onSuccess: setResult })}
          style={{ flexShrink: 0 }}
        >
          Jalankan Sync
        </Button>
      </div>
    </div>
  );
}

export default function CompanyProfilePage() {
  const { data, isLoading } = useTenantProfile();
  const update = useUpdateTenantProfile();
  const uploadLogo = useUploadLogo();
  const uploadFavicon = useUploadFavicon();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    uploadLogo.mutate(formData);
  };

  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    uploadFavicon.mutate(formData);
  };

  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', motto: '', about: '' });
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name, email: data.email, phone: data.phone,
        address: data.address ?? '', motto: data.motto ?? '', about: data.about ?? '',
      });
      try {
        setBankAccounts(data.bankAccounts ? JSON.parse(data.bankAccounts) : []);
      } catch {
        setBankAccounts([]);
      }
    }
  }, [data]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const updateBank = (i: number, field: keyof BankAccount, value: string) => {
    setBankAccounts((prev) => prev.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)));
  };

  const addBank = () => setBankAccounts((p) => [...p, { bankName: '', accountNumber: '', accountName: '' }]);
  const removeBank = (i: number) => setBankAccounts((p) => p.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({ ...form, bankAccounts });
  };

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><Spinner size="lg" /></div>;
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <Building2 size={20} style={{ color: 'var(--nav-active-icon)' }} />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Profil Perusahaan</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
              Data ini muncul di invoice yang dikirim ke pelanggan
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            display: 'flex', gap: 16, padding: 16, background: 'var(--surface-2)',
            border: '1px solid var(--border)', borderRadius: 14, marginBottom: 4,
          }}>
            {/* Logo */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Logo</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {data?.logoUrl ? (
                    <img src={data.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <ImageUp size={20} style={{ color: 'var(--text-3)' }} />
                  )}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                <Button type="button" variant="outline" size="sm" loading={uploadLogo.isPending} onClick={() => logoInputRef.current?.click()}>
                  Ganti Logo
                </Button>
              </div>
            </div>

            {/* Favicon */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Favicon</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {data?.faviconUrl ? (
                    <img src={data.faviconUrl} alt="Favicon" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
                  ) : (
                    <ImageUp size={20} style={{ color: 'var(--text-3)' }} />
                  )}
                </div>
                <input ref={faviconInputRef} type="file" accept="image/*" onChange={handleFaviconChange} style={{ display: 'none' }} />
                <Button type="button" variant="outline" size="sm" loading={uploadFavicon.isPending} onClick={() => faviconInputRef.current?.click()}>
                  Ganti Favicon
                </Button>
              </div>
            </div>
          </div>
          <Input label="Nama Perusahaan" value={form.name} onChange={set('name')} required />
          <Input label="Motto / Slogan" placeholder="Membangun Kemandirian Desa..." value={form.motto} onChange={set('motto')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
            <Input label="Telepon / WhatsApp" value={form.phone} onChange={set('phone')} required />
          </div>
          <Textarea label="Alamat" value={form.address} onChange={set('address')} rows={2} />
          <Textarea label="Tentang Perusahaan" value={form.about} onChange={set('about')} rows={3} />

          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
            color: 'var(--text-3)', marginTop: 10, marginBottom: 4,
            paddingBottom: 8, borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            Rekening Bank
            <button type="button" onClick={addBank} style={{
              display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
              color: 'var(--nav-active-text)', cursor: 'pointer', fontSize: 11, fontWeight: 600, textTransform: 'none',
            }}>
              <Plus size={12} /> Tambah Rekening
            </button>
          </div>

          {bankAccounts.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <Input label="Bank" placeholder="BRI" value={b.bankName} onChange={(e) => updateBank(i, 'bankName', e.target.value)} />
              <Input label="No. Rekening" placeholder="123456789" value={b.accountNumber} onChange={(e) => updateBank(i, 'accountNumber', e.target.value)} />
              <Input label="Atas Nama" placeholder="PT ..." value={b.accountName} onChange={(e) => updateBank(i, 'accountName', e.target.value)} />
              <button type="button" onClick={() => removeBank(i)} style={{
                height: 40, width: 40, flexShrink: 0, background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 10, cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
            color: 'var(--text-3)', marginTop: 24, marginBottom: 12,
            paddingBottom: 8, borderBottom: '1px solid var(--border)',
          }}>
            System Tools
          </div>
          <RadiusSyncTool />

          <Button size="sm" loading={update.isPending} type="submit" style={{ marginTop: 12, alignSelf: 'flex-start' }}>
            Simpan Profil
          </Button>
        </form>
      </div>
    </div>
  );
}