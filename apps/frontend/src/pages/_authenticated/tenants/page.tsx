import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Building2, Power, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { TenantForm } from './components/tenant-form';
import { useTenants, useToggleTenantActive } from '@/hooks/useTenants';

export default function TenantsPage() {
  const { data: tenants, isLoading } = useTenants();
  const toggleActive = useToggleTenantActive();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Mitra</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
              {tenants?.length ?? 0} mitra terdaftar di platform
            </p>
          </div>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setFormOpen(true)}>
            Tambah Mitra
          </Button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Spinner size="lg" />
          </div>
        ) : !tenants?.length ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
          }}>
            <Building2 size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Belum ada mitra</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
              Daftarkan mitra pertama untuk mulai berlangganan
            </p>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setFormOpen(true)} style={{ marginTop: 16 }}>
              Tambah Mitra
            </Button>
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)', borderRadius: 16, overflow: 'hidden',
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Mitra', 'Kode', 'Kontak', 'Status', ''].map((h) => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left', fontSize: 11,
                      fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.05em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10,
                          background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
                        }}>
                          {t.name[0]?.toUpperCase()}
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{t.name}</p>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 12, fontFamily: 'monospace', color: 'var(--nav-active-text)',
                        background: 'var(--nav-active-bg)', padding: '2px 8px', borderRadius: 6,
                      }}>
                        {t.slug}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{t.email}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.phone}</p>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={t.isActive ? 'active' : 'terminated'}>
                        {t.isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link
                          to={`/users?tenantId=${t.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '5px 10px', borderRadius: 7, border: '1px solid var(--nav-active-icon)',
                            background: 'var(--nav-active-bg)', textDecoration: 'none',
                            fontSize: 12, color: 'var(--nav-active-text)',
                          }}
                        >
                          <UserCog size={12} /> Pengguna
                        </Link>
                        <button
                          onClick={() => toggleActive.mutate(t.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)',
                            background: 'var(--surface-2)', cursor: 'pointer',
                            fontSize: 12, color: 'var(--text-2)',
                          }}
                        >
                          <Power size={12} /> {t.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TenantForm open={formOpen} onClose={() => setFormOpen(false)} />
    </>
  );
}