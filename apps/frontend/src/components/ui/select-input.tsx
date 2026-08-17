import { ChevronDown } from 'lucide-react';

interface Option {
  value: string | number;
  label: string;
}

interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: Option[];
  placeholder?: string;
}

export function SelectInput({
  label, error, hint, options, placeholder, className, ...props
}: SelectInputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
          {label}
          {props.required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <select
          style={{
            width: '100%', height: 42, padding: '0 36px 0 12px',
            borderRadius: 10, fontSize: 14, color: 'var(--text-1)',
            background: 'var(--input-bg)', border: `1.5px solid ${error ? '#EF4444' : 'var(--border-strong)'}`,
            appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
            outline: 'none', fontFamily: 'inherit',
          }}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown
          size={15}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-3)', pointerEvents: 'none',
          }}
        />
      </div>
      {error && <p style={{ fontSize: 12, color: '#EF4444' }}>{error}</p>}
      {!error && hint && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{hint}</p>}
    </div>
  );
}