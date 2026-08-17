import { useState } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', userSelect: 'none' }}
        >
          {label}
          {props.required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
        </label>
      )}

      <input
        id={inputId}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: 40,
          padding: '0 12px',
          borderRadius: 10,
          fontSize: 14,
          color: 'var(--text-1)',
          background: 'var(--input-bg)',
          border: `1.5px solid ${error ? '#EF4444' : focused ? '#4F46E5' : 'var(--input-border)'}`,
          outline: 'none',
          width: '100%',
          fontFamily: 'inherit',
          transition: 'border-color 0.15s ease',
        }}
        {...props}
      />

      {error && <p style={{ fontSize: 12, color: '#EF4444', marginTop: -2 }}>{error}</p>}
      {hint && !error && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: -2 }}>{hint}</p>}
    </div>
  );
}