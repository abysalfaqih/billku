type Variant =
  | 'active' | 'isolated' | 'suspended' | 'terminated'
  | 'paid' | 'unpaid' | 'overdue' | 'cancelled'
  | 'success' | 'warning' | 'danger' | 'info' | 'default';

interface StyleEntry { bg: string; color: string; border: string; }

const STYLES: Record<Variant, StyleEntry> = {
  active:     { bg: 'rgba(22,163,74,0.10)',   color: '#15803D', border: '1px solid rgba(22,163,74,0.25)' },
  isolated:   { bg: 'rgba(239,68,68,0.10)',   color: '#B91C1C', border: '1px solid rgba(239,68,68,0.25)' },
  suspended:  { bg: 'rgba(245,158,11,0.10)',  color: '#B45309', border: '1px solid rgba(245,158,11,0.25)' },
  terminated: { bg: 'rgba(107,114,128,0.10)', color: '#6B7280', border: '1px solid rgba(107,114,128,0.25)' },

  paid:       { bg: 'rgba(22,163,74,0.10)',   color: '#15803D', border: '1px solid rgba(22,163,74,0.25)' },
  unpaid:     { bg: 'rgba(245,158,11,0.10)',  color: '#B45309', border: '1px solid rgba(245,158,11,0.25)' },
  overdue:    { bg: 'rgba(239,68,68,0.10)',   color: '#B91C1C', border: '1px solid rgba(239,68,68,0.25)' },
  cancelled:  { bg: 'rgba(107,114,128,0.10)', color: '#6B7280', border: '1px solid rgba(107,114,128,0.25)' },

  success:    { bg: 'rgba(22,163,74,0.10)',   color: '#15803D', border: '1px solid rgba(22,163,74,0.25)' },
  warning:    { bg: 'rgba(245,158,11,0.10)',  color: '#B45309', border: '1px solid rgba(245,158,11,0.25)' },
  danger:     { bg: 'rgba(239,68,68,0.10)',   color: '#B91C1C', border: '1px solid rgba(239,68,68,0.25)' },
  info:       { bg: 'rgba(79,70,229,0.10)',   color: '#4338CA', border: '1px solid rgba(79,70,229,0.25)' },
  default:    { bg: 'rgba(107,114,128,0.10)', color: '#6B7280', border: '1px solid rgba(107,114,128,0.25)' },
};

const LABELS: Partial<Record<Variant, string>> = {
  active:     'Aktif',
  isolated:   'Diisolir',
  suspended:  'Ditangguhkan',
  terminated: 'Berhenti',
  paid:       'Lunas',
  unpaid:     'Belum Bayar',
  overdue:    'Jatuh Tempo',
  cancelled:  'Dibatalkan',
};

interface BadgeProps {
  variant?: Variant;
  children?: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  const s = STYLES[variant];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
      border: s.border,
      whiteSpace: 'nowrap',
    }}>
      {children ?? LABELS[variant] ?? variant}
    </span>
  );
}