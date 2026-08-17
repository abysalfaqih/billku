import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, React.CSSProperties> = {
  primary: { background: '#4F46E5', color: '#fff' },
  secondary: { background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)' },
  ghost: { background: 'transparent', color: 'var(--text-2)' },
  danger: { background: '#DC2626', color: '#fff' },
  outline: { background: 'var(--surface)', color: 'var(--text-1)', border: '1px solid var(--border)' },
};

const SIZE: Record<Size, React.CSSProperties> = {
  xs: { height: 26, padding: '0 10px', fontSize: 11, borderRadius: 7, gap: 4 },
  sm: { height: 32, padding: '0 12px', fontSize: 12, borderRadius: 8, gap: 6 },
  md: { height: 36, padding: '0 14px', fontSize: 13, borderRadius: 9, gap: 7 },
  lg: { height: 42, padding: '0 18px', fontSize: 14, borderRadius: 11, gap: 8 },
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary', size = 'md', loading = false,
  icon, children, style, disabled, ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        border: 'none',
        transition: 'opacity 0.15s, filter 0.15s',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        outline: 'none',
        ...VARIANT[variant],
        ...SIZE[size],
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          (e.currentTarget as HTMLElement).style.filter = 'brightness(0.9)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.filter = 'none';
      }}
    >
      {loading
        ? <Loader2 size={SIZE[size].fontSize as number} style={{ animation: 'btnSpin 0.7s linear infinite', flexShrink: 0 }} />
        : icon && <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>
      }
      {children && <span>{children}</span>}
      <style>{`@keyframes btnSpin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}