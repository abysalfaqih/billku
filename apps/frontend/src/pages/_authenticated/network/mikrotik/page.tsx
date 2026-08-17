import { useState } from 'react';
import { Plus, Router, Trash2, Edit2, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { MikrotikForm } from './components/mikrotik-form';
import { useMikrotikConfigs, useTestMikrotik, useDeleteMikrotik } from '@/hooks/useMikrotik';
import type { MikrotikConfig } from '@/types';

function MikrotikCard({
  config, onEdit, onDelete,
}: {
  config: MikrotikConfig;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const testConn = useTestMikrotik();

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Router size={20} color="white" strokeWidth={1.75} />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{config.name}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'monospace', marginTop: 2 }}>
              {config.host}:{config.port}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onEdit}
            style={{
              width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={onDelete}
            style={{
              width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface-2)', cursor: 'pointer', color: '#EF4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
        <span>User: <strong style={{ color: 'var(--text-2)' }}>{config.username}</strong></span>
      </div>

      <Button
        variant="outline"
        size="sm"
        // icon={<Zap size={13} />}
        loading={testConn.isPending}
        onClick={() => testConn.mutate(config.id)}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        Tes Koneksi
      </Button>
    </div>
  );
}

export default function MikrotikPage() {
  const { data: configs, isLoading } = useMikrotikConfigs();
  const deleteMikrotik = useDeleteMikrotik();
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<MikrotikConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MikrotikConfig | null>(null);

  const openAdd = () => { setSelected(null); setFormOpen(true); };
  const openEdit = (c: MikrotikConfig) => { setSelected(c); setFormOpen(true); };

  return (
    <>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>
            Tambah Mikrotik
          </Button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Spinner size="lg" />
          </div>
        ) : !configs?.length ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
          }}>
            <Router size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Belum ada Mikrotik</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
              Hubungkan router Mikrotik pertama Anda
            </p>
            <Button size="sm" icon={<Plus size={14} />} onClick={openAdd} style={{ marginTop: 16 }}>
              Tambah Mikrotik
            </Button>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16,
          }}>
            {configs.map((c) => (
              <MikrotikCard key={c.id} config={c} onEdit={() => openEdit(c)} onDelete={() => setDeleteTarget(c)} />
            ))}
          </div>
        )}
      </div>

      <MikrotikForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setSelected(null); }}
        config={selected}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMikrotik.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        loading={deleteMikrotik.isPending}
        title="Hapus Mikrotik?"
        description={`Router "${deleteTarget?.name}" akan dihapus dari sistem. Pastikan tidak ada IP Pool yang masih terhubung.`}
        confirmLabel="Ya, Hapus"
      />
    </>
  );
}