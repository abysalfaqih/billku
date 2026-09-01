import { useState } from 'react';
import { Plus, Network, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { IpPoolForm } from './components/ip-pool-form';
import { useIpPools, useDeleteIpPool } from '@/hooks/useIpPools';
import { useMikrotikConfigs } from '@/hooks/useMikrotik';
import type { IpPool } from '@/types';

export default function IpPoolsPage() {
  const { data: pools, isLoading } = useIpPools();
  const { data: mikrotikConfigs } = useMikrotikConfigs();
  const deletePool = useDeleteIpPool();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IpPool | null>(null);

  const mikrotikName = (id: number) =>
    mikrotikConfigs?.find((m) => m.id === id)?.name ?? `Router #${id}`;

  return (
    <>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setFormOpen(true)}>
            Tambah IP Pool
          </Button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Spinner size="lg" />
          </div>
        ) : !pools?.length ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
          }}>
            <Network size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Belum ada IP Pool</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
              Buat IP Pool untuk digunakan di paket internet
            </p>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setFormOpen(true)} style={{ marginTop: 16 }}>
              Tambah IP Pool
            </Button>
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)', borderRadius: 16,
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          }}>
            <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Nama', 'Network', 'Gateway', 'Range IP', 'Router', ''].map((h) => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left', fontSize: 11,
                      fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.05em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pools.map((pool) => (
                  <tr
                    key={pool.id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{pool.displayName}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace', marginTop: 1 }}>
                        {pool.name}
                      </p>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-2)' }}>
                        {pool.network}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-2)' }}>
                        {pool.gateway}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-3)' }}>
                        {pool.ipStart} – {pool.ipEnd}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        {mikrotikName(pool.mikrotikConfigId)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => setDeleteTarget(pool)}
                        style={{
                          width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
                          background: 'var(--surface-2)', cursor: 'pointer', color: '#EF4444',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <IpPoolForm open={formOpen} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deletePool.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        loading={deletePool.isPending}
        title="Hapus IP Pool?"
        description={`IP Pool "${deleteTarget?.displayName}" akan dihapus dari Mikrotik dan FreeRADIUS.`}
        confirmLabel="Ya, Hapus"
      />
    </>
  );
}