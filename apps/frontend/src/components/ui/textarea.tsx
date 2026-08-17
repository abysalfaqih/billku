interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, ...props }: TextareaProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
          {label}
          {props.required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
        </label>
      )}
      <textarea
        style={{
          padding: '10px 12px', borderRadius: 10, fontSize: 14,
          color: 'var(--text-1)', background: 'var(--input-bg)',
          border: `1.5px solid ${error ? '#EF4444' : 'var(--border-strong)'}`,
          resize: 'vertical', minHeight: 80, outline: 'none',
          fontFamily: 'inherit', lineHeight: 1.5,
        }}
        {...props}
      />
      {error && <p style={{ fontSize: 12, color: '#EF4444' }}>{error}</p>}
    </div>
  );
}