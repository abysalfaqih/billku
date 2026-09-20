import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDeleteTenant } from '@/hooks/useTenants';
import type { Tenant } from '@/types';

interface DeleteTenantDialogProps {
  open: boolean;
  onClose: () => void;
  tenant: Tenant | null;
}

// Penghapusan mitra bersifat PERMANEN dan mencakup seluruh data turunannya
// (pengguna, pelanggan, tagihan, pembayaran, invoice, langganan, dst).
// Karena dampaknya besar & tidak bisa dibatalkan, admin diwajibkan mengetik
// ulang kode mitra (slug) persis sama sebelum tombol hapus aktif — supaya
// tidak ada penghapusan yang terjadi karena salah klik.
export function DeleteTenantDialog({ open, onClose, tenant }: DeleteTenantDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const deleteTenant = useDeleteTenant();

  useEffect(() => {
    if (open) setConfirmText('');
  }, [open, tenant?.id]);

  if (!tenant) return null;

  const isMatch = confirmText.trim() === tenant.slug;

  const handleDelete = () => {
    if (!isMatch) return;
    deleteTenant.mutate(tenant.id, { onSuccess: () => onClose() });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Hapus Mitra Secara Permanen"
      subtitle={tenant.name}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={deleteTenant.isPending}>
            Batal
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            loading={deleteTenant.isPending}
            disabled={!isMatch}
          >
            Hapus Permanen
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          display: 'flex', gap: 10, padding: 12, borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
        }}>
          <AlertTriangle size={18} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Tindakan ini akan menghapus mitra <strong>{tenant.name}</strong> beserta{' '}
            <strong>seluruh data yang menempel padanya secara permanen</strong>, termasuk:
            pengguna/staff mitra, pelanggan, tagihan &amp; riwayat pembayaran, paket &amp; IP pool,
            konfigurasi Mikrotik &amp; WhatsApp, invoice mitra, dan riwayat langganan mitra.
            Data yang sudah terhapus <strong>tidak bisa dikembalikan</strong>.
          </p>
        </div>

        <Input
          label={`Ketik "${tenant.slug}" untuk konfirmasi`}
          placeholder={tenant.slug}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
        />
      </div>
    </Dialog>
  );
}
