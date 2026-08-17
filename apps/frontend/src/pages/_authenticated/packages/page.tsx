import { useState } from 'react';
import { Plus, Edit2, Trash2, Package as PkgIcon, Network, AlertTriangle } from 'lucide-react';
import { useIpPools } from '@/hooks/useIpPools';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { PackageForm } from './components/package-form';
import { usePackages, useDeletePackage } from '@/hooks/usePackages';
import type { Package } from '@/types';

function formatRp(v: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(v));
}

function PackageRow({
  pkg, number, poolName, onEdit, onDelete,
}: {
  pkg: Package;
  number: number;
  poolName: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-3)' }}>
        {number}
      </td>

      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{pkg.name}</span>
          {!pkg.isActive && <Badge variant="terminated">Nonaktif</Badge>}
        </div>
        {pkg.description && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{pkg.description}</p>
        )}
      </td>

      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
        {pkg.speedDownload} Mbps
      </td>

      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
        {pkg.speedUpload} Mbps
      </td>

      <td style={{ padding: '12px 16px' }}>
        {poolName ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
            color: 'var(--nav-active-text)', background: 'var(--nav-active-bg)',
            padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap',
          }}>
            <Network size={12} /> {poolName}
          </div>
        ) : (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
            color: '#D97706', background: 'rgba(245,158,11,0.1)',
            padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap',
          }}>
            <AlertTriangle size={12} /> Belum terhubung
          </div>
        )}
      </td>

      <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, color: '#4F46E5', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {formatRp(pkg.price)}
      </td>

      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" icon={<Edit2 size={13} />} onClick={onEdit} />
          <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={onDelete} style={{ color: '#EF4444' }} />
        </div>
      </td>
    </tr>
  );
}

export default function PackagesPage() {
  const { data: packages, isLoading } = usePackages();
  const { data: ipPools } = useIpPools();
  const deletePackage = useDeletePackage();
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Package | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null);

  const openAdd = () => { setSelected(null); setFormOpen(true); };
  const openEdit = (p: Package) => { setSelected(p); setFormOpen(true); };
  const poolName = (id: number | null) => ipPools?.find((p) => p.id === id)?.displayName ?? null;

  return (
    <>
      <div style={{ padding: '20px 24px', maxWidth: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Paket Internet</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
              {packages?.length ?? 0} paket internet tersedia
            </p>
          </div>
          <Button icon={<Plus size={14} />} size="sm" onClick={openAdd}>
            Tambah Paket
          </Button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Spinner size="lg" />
          </div>
        ) : !packages?.length ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: 'var(--surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <PkgIcon size={24} style={{ color: 'var(--text-3)' }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Belum ada paket</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Buat paket internet pertama</p>
            <Button size="sm" icon={<Plus size={14} />} onClick={openAdd} style={{ marginTop: 16 }}>
              Tambah Paket
            </Button>
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 16, boxShadow: 'var(--shadow-sm)',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          }}>
            <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', textAlign: 'left' }}>No</th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', textAlign: 'left' }}>Paket</th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', textAlign: 'left' }}>Download</th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', textAlign: 'left' }}>Upload</th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', textAlign: 'left' }}>IP Pool</th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', textAlign: 'right' }}>Harga / Bulan</th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((p, i) => (
                  <PackageRow
                    key={p.id}
                    pkg={p}
                    number={i + 1}
                    poolName={poolName(p.ipPoolId)}
                    onEdit={() => openEdit(p)}
                    onDelete={() => setDeleteTarget(p)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PackageForm open={formOpen} onClose={() => setFormOpen(false)} pkg={selected} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deletePackage.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        loading={deletePackage.isPending}
        title="Nonaktifkan Paket?"
        description={`Paket "${deleteTarget?.name}" akan dinonaktifkan. Pelanggan yang sudah memakai paket ini tidak terpengaruh.`}
        confirmLabel="Nonaktifkan"
      />
    </>
  );
}