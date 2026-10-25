import { useEffect, useRef, useState } from 'react';
import { CalendarCheck, AlertCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { SelectInput } from '@/components/ui/select-input';
import { Textarea } from '@/components/ui/textarea';
import { apiErrorMessage, useAdvancePreview, useCreateAdvancePayment } from '@/hooks/usePayments';
import toast from 'react-hot-toast';

interface AdvancePayDialogProps {
  open: boolean;
  onClose: () => void;
  customerId: number;
  customerName: string;
}

function formatRp(v: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(v));
}

// 'YYYY-MM-DD' → tanggal lokal (new Date('YYYY-MM-DD') memakai UTC dan bisa mundur sehari)
function formatYmd(s: string) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} bulan`,
}));

export function AdvancePayDialog({ open, onClose, customerId, customerName }: AdvancePayDialogProps) {
  const [months, setMonths] = useState('1');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  // Setiap dialog dibuka mulai dari awal — jangan membawa pilihan dari pelanggan/pembukaan sebelumnya.
  useEffect(() => {
    if (open) { setMonths('1'); setMethod('cash'); setNotes(''); }
  }, [open, customerId]);

  const monthsNum = Number(months);
  const preview = useAdvancePreview(customerId, monthsNum, open);
  const pay = useCreateAdvancePayment((res) => {
    toast.success(`Pembayaran di muka ${res.months} bulan dicatat — ${formatRp(res.totalAmount)}`);
    onClose();
  });

  const plan = preview.data && preview.data.items.length === monthsNum ? preview.data : null;
  const busy = preview.isFetching || pay.isPending;
  const canSubmit = !!plan && !busy && !preview.isError;

  // Penjaga klik beruntun: status "sedang mengirim" dari react-query baru tiba sesaat
  // setelah klik pertama, jadi klik kedua yang sangat cepat bisa lolos dari `canSubmit`.
  const submitting = useRef(false);

  const handlePay = () => {
    if (!plan || !canSubmit || submitting.current) return;
    submitting.current = true;
    pay.mutate(
      {
        customerId,
        months: monthsNum,
        fromPeriodStart: plan.items[0].periodStart,
        paymentMethod: method as 'cash' | 'transfer' | 'other',
        notes: notes.trim() || undefined,
      },
      { onSettled: () => { submitting.current = false; } },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Bayar di Muka"
      subtitle={`Pelanggan ${customerName}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Batal</Button>
          <Button
            size="sm"
            icon={<CalendarCheck size={13} />}
            loading={pay.isPending}
            disabled={!canSubmit}
            onClick={handlePay}
          >
            Konfirmasi Lunas
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SelectInput
          label="Dibayar untuk berapa bulan ke depan?"
          value={months}
          onChange={(e) => setMonths(e.target.value)}
          options={MONTH_OPTIONS}
          disabled={pay.isPending}
        />

        {/* Pratinjau periode — persis yang akan dicatat sistem */}
        <div
          data-testid="advance-preview"
          style={{
            background: 'var(--surface-2)', borderRadius: 12, padding: '12px 14px',
            border: '1px solid var(--border)', minHeight: 64,
          }}
        >
          {preview.isFetching && !preview.isError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 12 }}>
              <Spinner size="sm" /> Menghitung periode…
            </div>
          )}

          {preview.isError && !preview.isFetching && (
            <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: '#B91C1C', fontSize: 13, lineHeight: 1.5 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{apiErrorMessage(preview.error, 'Pratinjau gagal dimuat')}</span>
            </div>
          )}

          {plan && !preview.isFetching && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {plan.items.map((it) => (
                <div
                  key={it.periodStart}
                  style={{
                    display: 'flex', justifyContent: 'space-between', gap: 12,
                    padding: '8px 0', borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                      {formatYmd(it.periodStart)} – {formatYmd(it.periodEnd)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {it.billNumber ? `Tagihan sudah ada · ${it.billNumber}` : 'Tagihan baru dibuat langsung lunas'}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
                    {formatRp(it.totalAmount)}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Total</span>
                <span data-testid="advance-total" style={{ fontSize: 16, fontWeight: 800, color: '#4F46E5' }}>
                  {formatRp(plan.totalAmount)}
                </span>
              </div>
            </div>
          )}
        </div>

        <SelectInput
          label="Metode Pembayaran"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={[
            { value: 'cash', label: 'Tunai (Cash)' },
            { value: 'transfer', label: 'Transfer Bank' },
            { value: 'other', label: 'Lainnya' },
          ]}
          disabled={pay.isPending}
        />

        <Textarea
          label="Catatan (opsional)"
          placeholder="Catatan pembayaran..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={450}
          disabled={pay.isPending}
        />

        <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, margin: 0 }}>
          Satu pembayaran dicatat untuk setiap periode, dan satu pesan WhatsApp konfirmasi dikirim ke pelanggan.
          Hanya untuk pelanggan aktif yang tidak punya tunggakan.
        </p>
      </div>
    </Dialog>
  );
}
