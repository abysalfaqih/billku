import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (p: number) => void;
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const btn = (content: React.ReactNode, p: number, disabled: boolean, active = false) => (
    <button
      key={String(p)}
      onClick={() => !disabled && onPageChange(p)}
      disabled={disabled}
      style={{
        minWidth: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
        background: active ? '#4F46E5' : 'var(--surface)',
        color: active ? 'white' : disabled ? 'var(--text-3)' : 'var(--text-2)',
        fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {content}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
        Menampilkan <strong style={{ color: 'var(--text-1)' }}>{from}–{to}</strong> dari <strong style={{ color: 'var(--text-1)' }}>{total}</strong>
      </p>
      <div style={{ display: 'flex', gap: 4 }}>
        {btn(<ChevronLeft size={14} />, page - 1, page === 1)}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p = i + 1;
          if (totalPages > 5) {
            if (page <= 3) p = i + 1;
            else if (page >= totalPages - 2) p = totalPages - 4 + i;
            else p = page - 2 + i;
          }
          return btn(p, p, false, p === page);
        })}
        {btn(<ChevronRight size={14} />, page + 1, page === totalPages)}
      </div>
    </div>
  );
}