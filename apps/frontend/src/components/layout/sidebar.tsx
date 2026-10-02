import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useSidebar } from '@/lib/sidebar-context';
import { useTenantProfile } from '@/hooks/useTenantProfile';
import {
  LayoutDashboard, Users, Package, FileText,
  CreditCard, BarChart3, Router, Network,
  MessageCircle, ClipboardList, Building2,
  Layers, Wifi, X, Activity, UserCog, MapPin,
  Receipt,
} from 'lucide-react';

interface NavItem { href: string; label: string; icon: React.ElementType; staffHidden?: boolean; }

const mainNav: NavItem[] = [
  { href: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/customers',  label: 'Pelanggan',   icon: Users },
  { href: '/packages',   label: 'Paket',        icon: Package, staffHidden: true },
  { href: '/billing',    label: 'Tagihan',      icon: FileText },
  { href: '/payments',   label: 'Pembayaran',   icon: CreditCard },
  { href: '/reports',    label: 'Laporan',      icon: BarChart3 },
];

const networkNav: NavItem[] = [
  { href: '/network/mikrotik', label: 'Mikrotik',   icon: Router, staffHidden: true },
  { href: '/network/ip-pools', label: 'IP Pool',    icon: Network, staffHidden: true },
  { href: '/network/areas',    label: 'Coverage',       icon: MapPin },
  { href: '/monitoring',       label: 'Monitoring', icon: Activity },
];

const baseSettingsNav: NavItem[] = [
  { href: '/company-profile', label: 'Perusahaan', icon: Building2 },
  { href: '/whatsapp',        label: 'WhatsApp',           icon: MessageCircle, staffHidden: true },
  { href: '/activity-logs',   label: 'Activity Log',       icon: ClipboardList },
];

const superAdminNav: NavItem[] = [
  { href: '/tenants',         label: 'Mitra',           icon: Building2 },
  { href: '/subscriptions',   label: 'Langganan',       icon: Layers },
  { href: '/tenant-invoices', label: 'Invoice Mitra',   icon: Receipt },
];

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = useLocation().pathname;
  const { close } = useSidebar();
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;

  return (
    <Link
      to={item.href}
      onClick={close}
      title={collapsed ? item.label : undefined}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 10, justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '10px 0' : '9px 12px', margin: '1px 6px', borderRadius: 10,
        fontSize: 13, fontWeight: isActive ? 600 : 400, textDecoration: 'none',
        transition: 'all 0.15s ease',
        color: isActive ? 'var(--nav-active-text)' : 'var(--text-2)',
        background: isActive ? 'var(--nav-active-bg)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--nav-hover)';
        (e.currentTarget as HTMLElement).style.color = isActive ? 'var(--nav-active-text)' : 'var(--text-1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = isActive ? 'var(--nav-active-bg)' : 'transparent';
        (e.currentTarget as HTMLElement).style.color = isActive ? 'var(--nav-active-text)' : 'var(--text-2)';
      }}
    >
      {isActive && !collapsed && (
        <span style={{
          position: 'absolute', left: 0, top: '20%', bottom: '20%',
          width: 3, borderRadius: '0 3px 3px 0', background: 'var(--nav-active-icon)',
        }} />
      )}
      <Icon
        size={17}
        style={{ color: isActive ? 'var(--nav-active-icon)' : 'var(--text-3)', flexShrink: 0 }}
        strokeWidth={isActive ? 2 : 1.75}
      />
      {!collapsed && item.label}
    </Link>
  );
}

function Section({ title, items, collapsed }: { title: string; items: NavItem[]; collapsed: boolean }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {!collapsed && (
        <p style={{
          padding: '0 12px', marginBottom: 4, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)',
        }}>
          {title}
        </p>
      )}
      {collapsed && <div style={{ height: 1, margin: '8px 10px', background: 'var(--border)' }} />}
      <div>{items.map((item) => <NavLink key={item.href} item={item} collapsed={collapsed} />)}</div>
    </div>
  );
}

export function Sidebar() {
  const { user } = useAuthStore();
  const { close, collapsed, toggleCollapse } = useSidebar();
  const { data: profile } = useTenantProfile();

  const isStaff = user?.role === 'staff';
  const visibleFor = (items: NavItem[]) => isStaff ? items.filter((i) => !i.staffHidden) : items;

  const visibleMainNav = visibleFor(mainNav);
  const visibleNetworkNav = visibleFor(networkNav);
  const settingsNav = isStaff
    ? visibleFor(baseSettingsNav)
    : [...baseSettingsNav, { href: '/users', label: 'Pengguna', icon: UserCog }];

  const brandName = profile?.name ?? 'Billku Tenjo';

  return (
    <aside style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--sidebar-bg)', borderRight: '1.5px solid var(--sidebar-border)',
      width: collapsed ? 'var(--sidebar-w-sm)' : 'var(--sidebar-w)',
      maxWidth: '85vw',
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
    }}>
      {/* Brand */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 56, flexShrink: 0,
        ...(collapsed
          ? { justifyContent: 'center', padding: '0' }
          : { gap: 10, padding: '0 16px' }),
        borderBottom: '1px solid var(--sidebar-border)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
          background: profile?.logoUrl
            ? 'var(--surface-2)'
            : 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {profile?.logoUrl ? (
            <img src={profile.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Wifi size={14} color="white" strokeWidth={2.5} />
          )}
        </div>
        {!collapsed && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text-1)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {brandName}
            </p>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={close}
            className="md:hidden"
            style={{ padding: 4, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        <Section title="Menu"        items={visibleMainNav}    collapsed={collapsed} />
        <Section title="Jaringan"    items={visibleNetworkNav} collapsed={collapsed} />
        <Section title="Pengaturan"  items={settingsNav}   collapsed={collapsed} />
        {user?.role === 'super_admin' && (
          <Section title="Admin" items={superAdminNav} collapsed={collapsed} />
        )}
      </nav>

      {/* User + Collapse */}
      <div style={{
        padding: '8px', borderTop: '1px solid var(--sidebar-border)',
        flexShrink: 0, position: 'relative',
      }}>
        {/* User info — hanya saat expanded */}
        {!collapsed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 10,
            background: 'var(--surface-2)', marginBottom: 6,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'white',
            }}>
              {user?.email?.[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-1)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {user?.email}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'capitalize' }}>
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
        )}
      </div>
      {/* Tombol toggle */}
      <button
        onClick={toggleCollapse}
        title={collapsed ? 'Perluas sidebar' : 'Tutup sidebar'}
        style={{
          position: 'absolute',
          right: -13,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 26, height: 26, borderRadius: '50%',
          border: '1.5px solid var(--sidebar-border)',
          background: 'var(--surface)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-2)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          zIndex: 10,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = '#4F46E5';
          (e.currentTarget as HTMLElement).style.color = 'white';
          (e.currentTarget as HTMLElement).style.borderColor = '#4F46E5';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-2)';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-border)';
        }}
      >
        {collapsed
          ? <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>›</span>
          : <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>‹</span>
        }
      </button>

    </aside>
  );
}