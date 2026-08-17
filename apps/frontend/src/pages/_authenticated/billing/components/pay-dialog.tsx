import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SelectInput } from '@/components/ui/select-input';
import { Textarea } from '@/components/ui/textarea';
import { useCreatePayment } from '@/hooks/usePayments';
import { CheckCircle2 } from 'lucide-react';
import type { Bill } from '@/types';

interface PayDialogProps {
  open: boolean;
  onClose: () => void;
  bill: Bill | null;
}

function formatRp(v: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(v));
}

export function PayDialog({ open, onClose, bill }: PayDialogProps) {
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const createPayment = useCreatePayment(onClose);

  if (!bill) return null;

  const handlePay = () => {
    createPayment.mutate({ billId: bill.id, paymentMethod: method as any, notes: notes || undefined });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tandai Lunas"
      subtitle={`Tagihan ${bill.billNumber}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Batal</Button>
          <Button
            size="sm"
            icon={<CheckCircle2 size={13} />}
            loading={createPayment.isPending}
            onClick={handlePay}
          >
            Konfirmasi Lunas
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Bill summary */}
        <div style={{
          background: 'var(--surface-2)', borderRadius: 12, padding: '14px 16px',
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Pelanggan</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>
              {bill.customerName ?? `#${bill.customerId}`}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No. Tagihan</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', fontFamily: 'monospace' }}>
              {bill.billNumber}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Paket</span>
            <span style={{ fontSize: 12, color: 'var(--text-1)' }}>{bill.packageName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#4F46E5' }}>
              {formatRp(bill.amount)}
            </span>
          </div>
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
        />

        <Textarea
          label="Catatan (opsional)"
          placeholder="Catatan pembayaran..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
    </Dialog>
  );
}