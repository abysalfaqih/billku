import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Building2 } from 'lucide-react';
import { useLogin } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ui/theme-toggle';

function Field({
  label, type = 'text', placeholder, value, onChange, icon: Icon,
  required, rightElement,
}: {
  label: string; type?: string; placeholder?: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ElementType; required?: boolean; rightElement?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label style={{
        display: 'block', fontSize: 13, fontWeight: 500,
        color: 'var(--text-2)', marginBottom: 6,
      }}>
        {label}
        {required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px', height: 46, borderRadius: 12,
        background: 'var(--input-bg)',
        border: `1.5px solid ${focused ? '#4F46E5' : 'var(--border-strong)'}`,
        transition: 'border-color 0.15s ease',
      }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <Icon size={15} style={{ color: focused ? '#4F46E5' : 'var(--text-3)', flexShrink: 0, transition: 'color 0.15s' }} strokeWidth={1.75} />
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          style={{
            flex: 1, background: 'transparent', outline: 'none',
            border: 'none', fontSize: 14, color: 'var(--text-1)',
            fontFamily: 'inherit',
          }}
        />
        {rightElement}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const login = useLogin();
  const [form, setForm] = useState({ tenantSlug: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      background: 'linear-gradient(145deg, #EEF2FF 0%, #F5F3FF 25%, #F0F4FF 55%, #F0F9FF 100%)',
    }}>
      {/* Soft gradient blobs via pseudo-background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background:
          'radial-gradient(ellipse 60% 50% at 15% 40%, rgba(165,180,252,0.25) 0%, transparent 100%), ' +
          'radial-gradient(ellipse 50% 40% at 85% 65%, rgba(196,181,253,0.20) 0%, transparent 100%)',
      }} />

      {/* Theme toggle */}
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
        <ThemeToggle />
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 400, margin: '0 16px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.8)',
        borderRadius: 24,
        boxShadow: '0 8px 40px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '36px 36px 28px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18, marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#FFFFFF',
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.07)',
              overflow: 'hidden',
            }}>
              <img
                src="/tenjoicon.png"
                alt="Billku Tenjo"
                width={48}
                height={48}
                style={{ objectFit: 'contain' }}
              />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
              BillingKU
            </h1>
            <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
              Masuk ke dashboard Anda
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => { e.preventDefault(); login.mutate(form); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <Field
              label="Kode Slug" placeholder="contoh: tenjo-hotspot"
              value={form.tenantSlug} onChange={set('tenantSlug')}
              icon={Building2} required
            />
            <Field
              label="Email" type="email" placeholder="admin@example.com"
              value={form.email} onChange={set('email')}
              icon={Mail} required
            />
            <Field
              label="Password" type={showPass ? 'text' : 'password'}
              placeholder="••••••••••"
              value={form.password} onChange={set('password')}
              icon={Lock} required
              rightElement={
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', display: 'flex' }}>
                  {showPass ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                </button>
              }
            />

            <button
              type="submit"
              disabled={login.isPending}
              style={{
                width: '100%', height: 48, borderRadius: 14, border: 'none',
                cursor: login.isPending ? 'not-allowed' : 'pointer',
                opacity: login.isPending ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 15, fontWeight: 600, color: 'white', marginTop: 6,
                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                boxShadow: '0 4px 16px rgba(79,70,229,0.4)',
                transition: 'opacity 0.15s, transform 0.1s',
                fontFamily: 'inherit',
              }}
            >
              {login.isPending ? (
                <div style={{
                  width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white', borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
              ) : (
                <>
                  <ArrowRight size={16} />
                  Masuk
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 36px', textAlign: 'center', fontSize: 12, color: '#9CA3AF',
          borderTop: '1px solid rgba(0,0,0,0.06)', background: 'rgba(249,250,251,0.8)',
        }}>
          © {new Date().getFullYear()} · PT. Tenjo Nurcahaya Jayabhatara
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}