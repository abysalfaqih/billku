import { useState } from 'react';
import { Plus, MapPin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { useAreas, useCreateArea, useDeleteArea } from '@/hooks/useAreas';
import type { Area } from '@/types';

export default function AreasPage() {
  const { data: areas, isLoading } = useAreas();
  const create = useCreateArea(() => setFormOpen(false));
  const deleteArea = useDeleteArea();
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Area | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(name, { onSuccess: () => setName('') });
  };

  return (
    <>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setFormOpen(true)}>
            Tambah Area
          </Button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><Spinner size="lg" /></div>
        ) : !areas?.length ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
            <MapPin size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Belum ada area</p>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setFormOpen(true)} style={{ marginTop: 16 }}>
              Tambah Area
            </Button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {areas.map((a) => (
              <div key={a.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MapPin size={15} style={{ color: 'var(--nav-active-icon)' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{a.name}</span>
                </div>
                <button
                  onClick={() => setDeleteTarget(a)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Tambah Area"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button size="sm" loading={create.isPending} onClick={handleSubmit as any}>Tambah</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <Input label="Nama Area" placeholder="contoh: Desa Sinarjaya" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteArea.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
        loading={deleteArea.isPending}
        title="Hapus Area?"
        description={`Area "${deleteTarget?.name}" akan dihapus.`}
        confirmLabel="Ya, Hapus"
      />
    </>
  );
}