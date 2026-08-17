import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquareText, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import {
  useWhatsappTemplates,
  useUpdateWhatsappTemplate,
  useResetWhatsappTemplate,
} from '@/hooks/useWhatsappTemplates';
import type { WhatsappTemplate, WhatsappTemplateType } from '@/types';

// Data contoh buat live preview — murni tampilan, tidak dikirim ke server
const SAMPLE_DATA: Record<WhatsappTemplateType, Record<string, string>> = {
  registration: { name: 'Budi Santoso', packageName: 'Paket 20 Mbps', username: 'budi123', billingDate: '15' },
  reminder: { name: 'Budi Santoso', billNumber: 'INV-0001', amount: '150.000', dueDate: '20 Juli 2026' },
  isolir: { name: 'Budi Santoso', billNumber: 'INV-0001', amount: '150.000' },
  payment: { name: 'Budi Santoso', billNumber: 'INV-0001', amount: '150.000', paidAt: '17 Juli 2026' },
};

function substituteVars(content: string, data: Record<string, string>): string {
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(data, key) ? data[key] : match,
  );
}

// Render *bold* dan baris baru ala bubble WhatsApp, tanpa dangerouslySetInnerHTML
function MessagePreviewText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {line.split(/(\*[^*]+\*)/g).map((part, j) =>
            part.startsWith('*') && part.endsWith('*') && part.length > 1
              ? <strong key={j}>{part.slice(1, -1)}</strong>
              : <span key={j}>{part}</span>,
          )}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

function TemplateCard({ template }: { template: WhatsappTemplate }) {
  const [content, setContent] = useState(template.content);
  const [confirmReset, setConfirmReset] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const update = useUpdateWhatsappTemplate();
  const reset = useResetWhatsappTemplate();

  // Sinkron ulang textarea kalau data server berubah (habis save / reset)
  useEffect(() => {
    setContent(template.content);
  }, [template.content]);

  const dirty = content !== template.content;
  const preview = useMemo(
    () => substituteVars(content, SAMPLE_DATA[template.type]),
    [content, template.type],
  );

  const insertVariable = (key: string) => {
    const placeholder = `{{${key}}}`;
    const el = textareaRef.current;
    if (!el) {
      setContent((c) => c + placeholder);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + placeholder + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + placeholder.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #25D366, #128C7E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageSquareText size={16} color="white" strokeWidth={1.75} />
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{template.label}</h3>
        </div>
        <Badge variant={template.isCustom ? 'info' : 'default'}>
          {template.isCustom ? 'Custom' : 'Default'}
        </Badge>
      </div>

      {/* Variabel yang bisa dipakai — klik buat sisipkan ke posisi kursor */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '14px 0' }}>
        {template.variables.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => insertVariable(v.key)}
            title={`Sisipkan — ${v.description}`}
            style={{
              fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
              padding: '4px 8px', borderRadius: 7, cursor: 'pointer',
              background: 'var(--surface-2)', color: '#4F46E5',
              border: '1px solid var(--border)',
            }}
          >
            {`{{${v.key}}}`}
          </button>
        ))}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(240px, 1fr)', gap: 16,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>TEMPLATE</span>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            style={{
              padding: '10px 12px', borderRadius: 10, fontSize: 13,
              color: 'var(--text-1)', background: 'var(--input-bg)',
              border: '1.5px solid var(--border-strong)', outline: 'none',
              resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.6,
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>PREVIEW</span>
          <div style={{
            background: '#DCF8C6', borderRadius: 10, padding: '10px 12px',
            fontSize: 13, lineHeight: 1.6, color: '#111B21',
            border: '1px solid rgba(0,0,0,0.06)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            minHeight: 172, maxHeight: 260, overflowY: 'auto',
          }}>
            <MessagePreviewText text={preview} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <button
          type="button"
          disabled={!template.isCustom || reset.isPending}
          onClick={() => setConfirmReset(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
            color: template.isCustom ? '#EF4444' : 'var(--text-3)',
            background: 'transparent', border: 'none', padding: 0,
            cursor: template.isCustom ? 'pointer' : 'not-allowed',
          }}
        >
          <RotateCcw size={13} /> Reset ke Default
        </button>

        <Button
          size="sm"
          icon={<Save size={13} />}
          disabled={!dirty}
          loading={update.isPending}
          onClick={() => update.mutate({ type: template.type, content })}
        >
          Simpan
        </Button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => reset.mutate(template.type, { onSuccess: () => setConfirmReset(false) })}
        loading={reset.isPending}
        title="Reset Template?"
        description={`Template "${template.label}" akan dikembalikan ke pesan default bawaan sistem. Perubahan custom Anda akan hilang.`}
        confirmLabel="Ya, Reset"
      />
    </div>
  );
}

export function WhatsappTemplates() {
  const { data: templates, isLoading } = useWhatsappTemplates();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {templates?.map((t) => (
        <TemplateCard key={t.type} template={t} />
      ))}
    </div>
  );
}
