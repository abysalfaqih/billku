interface SwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Switch({ label, description, checked, onChange }: SwitchProps) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
        background: 'var(--surface-2)', border: '1px solid var(--border)',
      }}
    >
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{label}</p>
        {description && (
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{description}</p>
        )}
      </div>
      <div style={{
        width: 38, height: 22, borderRadius: 99, flexShrink: 0, marginLeft: 12,
        background: checked ? '#4F46E5' : 'var(--border-strong)',
        position: 'relative', transition: 'background 0.2s',
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
    </div>
  );
}