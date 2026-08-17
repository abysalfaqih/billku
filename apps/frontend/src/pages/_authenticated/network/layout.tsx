import { Link, useLocation, Outlet } from 'react-router-dom';
import { Router, Network, MapPin } from 'lucide-react';

const tabs = [
  { href: '/network/mikrotik', label: 'Mikrotik', icon: Router },
  { href: '/network/ip-pools', label: 'IP Pool',  icon: Network },
  { href: '/network/areas',    label: 'Area',      icon: MapPin },
];

export default function NetworkLayout() {
  const pathname = useLocation().pathname;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        flexShrink: 0,
      }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>Jaringan</h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
              Manage Mikrotik, IP Pool dan Coverage
            </p>
          </div>
        </div>

        <div style={{ display: 'flex' }}>
          {tabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                to={tab.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 16px', fontSize: 13, fontWeight: 500,
                  textDecoration: 'none', whiteSpace: 'nowrap',
                  borderBottom: `2px solid ${isActive ? '#4F46E5' : 'transparent'}`,
                  color: isActive ? '#4F46E5' : 'var(--text-3)',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={14} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </div>
    </div>
  );
}