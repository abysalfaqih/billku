import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGenerateBill } from '@/hooks/useBilling';
import { useCustomers } from '@/hooks/useCustomers';
import { Zap } from 'lucide-react';
import type { Customer } from '@/types';

interface GenerateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GenerateDialog({ open, onClose }: GenerateDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const { data } = useCustomers({ search, status: 'active', limit: 10 });
  const generate = useGenerateBill(onClose);

  return (
    <Dialog
      open={open}
      onClose={() => { onClose(); setSelected(null); setSearch(''); }}
      title="Generate Tagihan"
      subtitle="Pilih pelanggan untuk dibuat tagihan bulan ini"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Batal</Button>
          <Button
            size="sm"
            icon={<Zap size={13} />}
            disabled={!selected}
            loading={generate.isPending}
            onClick={() => selected && generate.mutate(selected.id)}
          >
            Generate
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input
          placeholder="Cari nama atau nomor HP..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
        />

        {selected ? (
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'var(--nav-active-bg)', border: '1.5px solid var(--nav-active-icon)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--nav-active-text)' }}>
                {selected.name}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{selected.phone}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18 }}
            >×</button>
          </div>
        ) : (
          <div style={{
            background: 'var(--surface-2)', borderRadius: 12,
            border: '1px solid var(--border)', overflow: 'hidden',
            maxHeight: 280, overflowY: 'auto',
          }}>
            {!data?.data.length ? (
              <p style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
                {search ? 'Tidak ditemukan' : 'Ketik nama pelanggan...'}
              </p>
            ) : (
              data.data.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelected(c)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nav-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'white',
                  }}>
                    {c.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{c.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.phone}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}