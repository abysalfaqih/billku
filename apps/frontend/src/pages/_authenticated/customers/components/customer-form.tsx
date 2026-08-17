import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SelectInput } from '@/components/ui/select-input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { usePackages } from '@/hooks/usePackages';
import { useAreas } from '@/hooks/useAreas';
import { useMikrotikConfigs, useHotspotProfiles } from '@/hooks/useMikrotik';
import { useCreateCustomer, useUpdateCustomer } from '@/hooks/useCustomers';
import type { Customer } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
}

const INIT: Record<string, string | number | boolean> = {
  connectionType: 'pppoe',
  packageId: '', areaId: '', mikrotikConfigId: '', hotspotProfile: '',
  name: '', phone: '', email: '', address: '', nik: '',
  usernamePppoe: '', passwordPppoe: '', ipAddress: '',
  billingDate: 1, installationDate: '', notes: '', status: 'active',
  taxEnabled: false, taxPercent: '',
};

function Section({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
      color: 'var(--text-3)', marginTop: 24, marginBottom: 12,
      paddingBottom: 8, borderBottom: '1px solid var(--border)',
    }}>
      {title}
    </div>
  );
}

export function CustomerForm({ open, onClose, customer }: Props) {
  const [form, setForm] = useState<Record<string, string | number | boolean>>(INIT);
  const isEdit = !!customer;

  const { data: packages }  = usePackages();
  const { data: areas }     = useAreas();
  const { data: mtkList }   = useMikrotikConfigs();

  const create = useCreateCustomer(onClose);
  const update = useUpdateCustomer(onClose);

  const mikrotikId   = form.connectionType === 'hotspot' && form.mikrotikConfigId
    ? Number(form.mikrotikConfigId) : null;
  const { data: hotspotProfiles, isLoading: loadingProfiles } = useHotspotProfiles(mikrotikId);

  useEffect(() => {
    if (!open) return;
    if (customer) {
      setForm({
        connectionType: customer.connectionType ?? 'pppoe',
        packageId: customer.packageId ?? '',
        areaId: customer.areaId ?? '',
        mikrotikConfigId: customer.mikrotikConfigId ?? '',
        hotspotProfile: customer.hotspotProfile ?? '',
        name: customer.name,
        phone: customer.phone,
        email: customer.email ?? '',
        address: customer.address ?? '',
        nik: customer.nik ?? '',
        usernamePppoe: customer.usernamePppoe ?? '',
        passwordPppoe: '',
        ipAddress: customer.ipAddress ?? '',
        billingDate: customer.billingDate,
        installationDate: customer.installationDate?.split('T')[0] ?? '',
        notes: customer.notes ?? '',
        status: customer.status,
        taxEnabled: customer.taxEnabled ?? false,
        taxPercent: customer.taxPercent ?? '',
      });
    } else {
      setForm(INIT);
    }
  }, [customer, open]);

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const isHotspot = form.connectionType === 'hotspot';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      connectionType: form.connectionType,
      packageId: Number(form.packageId),
      areaId: Number(form.areaId),
      name: form.name,
      phone: String(form.phone),
      billingDate: Number(form.billingDate),
      taxEnabled: !!form.taxEnabled,
    };

    if (form.taxEnabled)       payload.taxPercent       = Number(form.taxPercent);
    if (form.email)            payload.email            = form.email;
    if (form.address)          payload.address          = form.address;
    if (form.nik)              payload.nik              = form.nik;
    if (form.installationDate) payload.installationDate = form.installationDate;
    if (form.notes)            payload.notes            = form.notes;
    if (form.usernamePppoe)    payload.usernamePppoe    = form.usernamePppoe;
    if (form.passwordPppoe)    payload.passwordPppoe    = form.passwordPppoe;

    if (isHotspot) {
      payload.mikrotikConfigId = Number(form.mikrotikConfigId);
      payload.hotspotProfile   = form.hotspotProfile;
    } else {
      if (form.ipAddress) payload.ipAddress = form.ipAddress;
    }

    if (isEdit) {
      if (form.status) payload.status = form.status;
      update.mutate({ id: customer!.id, data: payload });
    } else {
      create.mutate(payload);
    }
  };

  const isPending       = create.isPending || update.isPending;
  const packageOptions  = (packages ?? []).map((p) => ({
    value: p.id, label: `${p.name} — Rp${Number(p.price).toLocaleString('id-ID')}`,
  }));
  const areaOptions     = (areas ?? []).map((a) => ({ value: a.id, label: a.name }));
  const mtkOptions      = (mtkList ?? []).map((m) => ({ value: m.id, label: `${m.name} (${m.host})` }));
  const profileOptions  = (hotspotProfiles ?? []).map((p) => ({ value: p, label: p }));
  const billingOptions  = Array.from({ length: 28 }, (_, i) => ({ value: i + 1, label: `Tanggal ${i + 1}` }));
  const statusOptions   = [
    { value: 'active',     label: 'Aktif' },
    { value: 'isolated',   label: 'Diisolir' },
    { value: 'suspended',  label: 'Ditangguhkan' },
    { value: 'terminated', label: 'Berhenti' },
  ];

  return (
    <Dialog
      open={open} onClose={onClose} size="lg"
      title={isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan'}
      subtitle={isEdit ? customer?.name : 'Isi data pelanggan baru'}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>Batal</Button>
          <Button size="sm" loading={isPending} onClick={handleSubmit as any}>
            {isEdit ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Tipe Koneksi */}
        <Section title="Tipe Koneksi" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {(['pppoe', 'hotspot'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setForm(p => ({ ...p, connectionType: type, mikrotikConfigId: '', hotspotProfile: '' }))}
              style={{
                height: 44, borderRadius: 10, border: '2px solid',
                borderColor: form.connectionType === type ? '#4F46E5' : 'var(--border)',
                background: form.connectionType === type ? 'var(--nav-active-bg)' : 'var(--surface)',
                color: form.connectionType === type ? '#4F46E5' : 'var(--text-2)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {type === 'pppoe' ? 'PPPoE' : 'Hotspot'}
            </button>
          ))}
        </div>
        {/* <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: -6 }}>
          {isHotspot
            ? 'Hotspot: user dibuat langsung ke Mikrotik, tidak pakai RADIUS'
            : 'PPPoE: auth via FreeRADIUS, kecepatan dikontrol RADIUS'}
        </p> */}

        {/* Info Dasar */}
        <Section title="Informasi Dasar" />
        <Input label="Nama Lengkap" placeholder="Budi Santoso"
          value={String(form.name)} onChange={set('name')} required />
        <Input label="No. HP" type="tel" placeholder="081234567890"
          value={String(form.phone)} onChange={set('phone')} required />
        <Input label="Email" type="email" placeholder="budi@example.com"
          value={String(form.email)} onChange={set('email')} />
        <Input label="NIK" placeholder="3201xxxx"
          value={String(form.nik)} onChange={set('nik')} />
        <Textarea label="Alamat" placeholder="Jl. Contoh No. 1..."
          value={String(form.address)} onChange={set('address')} rows={2} />
        <SelectInput label="Area" value={String(form.areaId)} onChange={set('areaId')}
          options={areaOptions} placeholder="Pilih area..." required />

        {/* Paket & Jaringan */}
        <Section title={isHotspot ? 'Paket & Hotspot' : 'Paket & PPPoE'} />

        {/* Paket billing (untuk semua tipe) */}
        <SelectInput
          label={isHotspot ? 'Paket Billing (Harga Bulanan)' : 'Paket Internet'}
          value={String(form.packageId)} onChange={set('packageId')}
          options={packageOptions} placeholder="Pilih paket..." required
          hint={isHotspot ? 'Untuk tagihan bulanan — kecepatan diatur di Profile Hotspot Mikrotik' : undefined}
        />

        {isHotspot ? (
          <>
            {/* Pilih Mikrotik */}
            <SelectInput
              label="Mikrotik Router"
              value={String(form.mikrotikConfigId)}
              onChange={(e) => setForm(p => ({ ...p, mikrotikConfigId: e.target.value, hotspotProfile: '' }))}
              options={mtkOptions}
              placeholder={mtkList?.length ? 'Pilih Mikrotik...' : 'Belum ada Mikrotik — tambahkan dulu'}
              required
              hint="Router Mikrotik yang menjalankan layanan Hotspot"
            />

            {/* Profile Hotspot — auto-load dari Mikrotik */}
            {mikrotikId && (
              loadingProfiles ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', color: 'var(--text-3)', fontSize: 13 }}>
                  <Spinner size="sm" /> Mengambil profile hotspot dari Mikrotik...
                </div>
              ) : profileOptions.length > 0 ? (
                <SelectInput
                  label="Profile Hotspot (dari Mikrotik)"
                  value={String(form.hotspotProfile)}
                  onChange={set('hotspotProfile')}
                  options={profileOptions}
                  placeholder="Pilih profile..."
                  required
                  hint={`${profileOptions.length} profile ditemukan — menentukan kecepatan & limit`}
                />
              ) : (
                <div style={{
                  padding: '10px 14px', borderRadius: 10, fontSize: 12, color: '#B45309',
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                }}>
                  Tidak ada hotspot profile di Mikrotik ini. Buat profile dulu di Mikrotik: IP → Hotspot → User Profiles.
                </div>
              )
            )}

            {/* Akun Hotspot */}
            <Input label="Username Hotspot" placeholder="budi123"
              value={String(form.usernamePppoe)} onChange={set('usernamePppoe')} required />
            <Input
              label={isEdit ? 'Password Hotspot (kosongkan jika tidak diubah)' : 'Password Hotspot'}
              type="password" placeholder={isEdit ? '(tidak diubah)' : 'password123'}
              value={String(form.passwordPppoe)} onChange={set('passwordPppoe')}
              required={!isEdit} />
          </>
        ) : (
          <>
            <Input label="Username PPPoE" placeholder="budi.santoso"
              value={String(form.usernamePppoe)} onChange={set('usernamePppoe')}
              autoComplete="off" />
            <Input
              label={isEdit ? 'Password PPPoE (kosongkan jika tidak diubah)' : 'Password PPPoE'}
              type="password" placeholder={isEdit ? '(tidak diubah)' : 'password'}
              value={String(form.passwordPppoe)} onChange={set('passwordPppoe')}
              autoComplete="new-password" />
            <Input label="IP Address (opsional)" placeholder="192.168.x.x"
              value={String(form.ipAddress)} onChange={set('ipAddress')} />
          </>
        )}

        {/* Penagihan */}
        <Section title="Penagihan" />
        <SelectInput label="Tanggal Tagihan" value={String(form.billingDate)}
          onChange={set('billingDate')} options={billingOptions} required />
        <Input label="Tanggal Instalasi" type="date"
          value={String(form.installationDate)} onChange={set('installationDate')} />
        <Switch
          label="PPN Aktif"
          description="Tagihan akan ditambahkan PPN"
          checked={!!form.taxEnabled}
          onChange={(v) => setForm(p => ({ ...p, taxEnabled: v }))}
        />
        {form.taxEnabled && (
          <Input label="Persentase PPN (%)" type="number" min="0.01" max="100" step="0.01"
            placeholder="11" value={String(form.taxPercent)} onChange={set('taxPercent')} required />
        )}

        {/* Status (edit only) */}
        {isEdit && (
          <>
            <Section title="Status" />
            <SelectInput label="Status Pelanggan" value={String(form.status)}
              onChange={set('status')} options={statusOptions} />
          </>
        )}

        {/* Catatan */}
        <Section title="Catatan" />
        <Textarea label="Catatan Tambahan" placeholder="Catatan internal..."
          value={String(form.notes)} onChange={set('notes')} rows={2} />

        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Dialog>
  );
}