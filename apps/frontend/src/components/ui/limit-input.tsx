interface LimitInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export function LimitInput({ label, value, onChange }: LimitInputProps) {
  const isUnlimited = value === -1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="number"
          min="0"
          disabled={isUnlimited}
          value={isUnlimited ? '' : value}
          placeholder={isUnlimited ? '∞' : '0'}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            flex: 1, height: 40, padding: '0 12px', borderRadius: 10, fontSize: 14,
            color: 'var(--text-1)', background: isUnlimited ? 'var(--surface-2)' : 'var(--input-bg)',
            border: '1.5px solid var(--input-border)', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <label style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)',
          cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={isUnlimited}
            onChange={(e) => onChange(e.target.checked ? -1 : 0)}
            style={{ width: 14, height: 14, cursor: 'pointer' }}
          />
          Unlimited
        </label>
      </div>
    </div>
  );
}