import { Search, X } from 'lucide-react';

interface SearchInputProps {
  /** Isi kotak (belum tentu sudah dicari — pencarian jalan saat Enter) */
  value: string;
  onChange: (v: string) => void;
  /** Dipanggil saat Enter ditekan, atau saat kotak dikosongkan lewat tombol X */
  onSubmit: (v: string) => void;
  placeholder?: string;
  /** Hasil pencarian yang sedang aktif — menentukan tampilnya tombol X */
  active?: boolean;
}

// Kotak pencarian halaman daftar (Tagihan, Pembayaran). Tampilannya sama dengan
// kotak cari di halaman Pelanggan: ketik lalu tekan Enter.
export function SearchInput({ value, onChange, onSubmit, placeholder, active }: SearchInputProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
      borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)',
      maxWidth: 420, flex: 1,
    }}>
      <Search size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(value); }}
        style={{
          flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
          fontSize: 13, color: 'var(--text-1)', fontFamily: 'inherit',
        }}
      />
      {(active || value) && (
        <button
          type="button"
          aria-label="Hapus pencarian"
          onClick={() => { onChange(''); onSubmit(''); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2,
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
