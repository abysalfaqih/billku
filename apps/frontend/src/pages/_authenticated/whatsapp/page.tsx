import { Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, MessageCircle, Trash2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { WhatsappForm } from './components/whatsapp-form';
import { WhatsappTemplates } from './components/whatsapp-templates';
import { useWhatsappConfigs, useTestWhatsapp, useDeleteWhatsappConfig } from '@/hooks/useWhatsapp';
import type { WhatsappConfig } from '@/types';

const PROVIDER_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  fonnte:  { label: 'Fonnte',  color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
  wablast: { label: 'WA Blast', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  meta:    { label: 'Meta Business', color: '#4F46E5', bg: 'rgba(79,70,229,0.1)' },
};

type WhatsappTab = 'configs' | 'templates';

/**
 * Tab aktif disimpan di query string (?tab=templates), bukan di useState biasa.
 * Alasannya: kalau disimpan di useState lokal, tab akan reset ke default
 * setiap kali halaman ini di-unmount (pindah ke halaman lain) lalu di-mount
 * ulang (balik lagi ke halaman ini) — walaupun data konfigurasi/template-nya
 * sendiri sebenarnya tidak pernah hilang (sudah di-cache React Query).
 * Dengan query string, tab yang dipilih bertahan baik saat navigasi SPA
 * maupun saat halaman di-reload penuh.
 */
function useWhatsappTab(): [WhatsappTab, (next: WhatsappTab) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: WhatsappTab = searchParams.get('tab') === 'templates' ? 'templates' : 'configs';

  const setTab = (next: WhatsappTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'configs') {
      params.delete('tab');
    } else {
      params.set('tab', next);
    }
    setSearchParams(params, { replace: true });
  };

  return [tab, setTab];
}

function ConfigCard({ config, onDelete }: { config: WhatsappConfig; onDelete: () => void }) {
  const testSend = useTestWhatsapp();
  const provider = PROVIDER_BADGE[config.provider];

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #25D366, #128C7E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageCircle size={20} color="white" strokeWidth={1.75} />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{config.name}</h3>
            <span style={{
              display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 600,
              padding: '2px 8px', borderRadius: 99, color: provider?.color, background: provider?.bg,
            }}>
              {provider?.label ?? config.provider}
            </span>
          </div>
        </div>
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

      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
        Nomor: <span style={{ fontFamily: 'monospace', color: 'var(--text-2)' }}>{config.senderNumber}</span>
      </p>

      <Button
        variant="outline" size="sm" icon={<Send size={13} />}
        loading={testSend.isPending}
        onClick={() => testSend.mutate(config.id)}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        Kirim Pesan Test
      </Button>
    </div>
  );
}

function WhatsappPageContent() {
  const { data: configs, isLoading } = useWhatsappConfigs();
  const deleteConfig = useDeleteWhatsappConfig();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WhatsappConfig | null>(null);
  const [tab, setTab] = useWhatsappTab();

  return (
    <>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Notifikasi WhatsApp</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
              Notifikasi untuk registrasi, reminder H-3, isolir, pembayaran lunas
            </p>
          </div>
          {tab === 'configs' && (
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setFormOpen(true)}>
              Tambah Provider
            </Button>
          )}
        </div>

        <div style={{
          display: 'inline-flex', padding: 3, borderRadius: 10, gap: 2, marginBottom: 20,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
        }}>
          {([
            { key: 'configs', label: 'Konfigurasi Provider' },
            { key: 'templates', label: 'Template Pesan' },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
                background: tab === t.key ? 'var(--surface)' : 'transparent',
                color: tab === t.key ? 'var(--text-1)' : 'var(--text-3)',
                boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'templates' ? (
          <WhatsappTemplates />
        ) : isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Spinner size="lg" />
          </div>
        ) : !configs?.length ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
          }}>
            <MessageCircle size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Belum ada provider WhatsApp</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
              Tambahkan Fonnte, WA Blast, atau Meta Business API
            </p>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setFormOpen(true)} style={{ marginTop: 16 }}>
              Tambah Provider
            </Button>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16,
          }}>
            {configs.map((c) => (
              <ConfigCard key={c.id} config={c} onDelete={() => setDeleteTarget(c)} />
            ))}
          </div>
        )}
      </div>

      <WhatsappForm open={formOpen} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteConfig.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        loading={deleteConfig.isPending}
        title="Hapus Konfigurasi?"
        description={`Konfigurasi "${deleteTarget?.name}" akan dihapus. Notifikasi WA tidak akan terkirim setelahnya.`}
        confirmLabel="Ya, Hapus"
      />
    </>
  );
}

// Catatan: di Next.js App Router dulu, useSearchParams() mewajibkan Suspense
// boundary atau build akan gagal. Di Vite/React Router hal itu tidak lagi
// berlaku, tapi struktur Suspense ini tetap dipertahankan (tidak berbahaya)
// supaya fallback loading state-nya identik dengan sebelumnya.
export default function WhatsappPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <Spinner size="lg" />
        </div>
      }
    >
      <WhatsappPageContent />
    </Suspense>
  );
}