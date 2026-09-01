import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { Sidebar } from '@/components/layout/sidebar';
import { TopNav } from '@/components/layout/top-nav';
import { SidebarProvider, useSidebar } from '@/lib/sidebar-context';
import { cn } from '@/lib/utils';
import { BrandingSync } from '@/components/branding-sync';

function LayoutInner() {
  const { isAuthenticated, _hydrated } = useAuthStore();
  const navigate = useNavigate();
  const { open, close, collapsed } = useSidebar();

  useEffect(() => {
    // Tunggu sampai state dari localStorage selesai dibaca
    if (!_hydrated) return;
    if (!isAuthenticated) navigate('/login', { replace: true });
  }, [_hydrated, isAuthenticated, navigate]);

  // Tampilkan loading saat state belum siap
  if (!_hydrated) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div style={{
          width: 32, height: 32, border: '3px solid var(--border)',
          borderTopColor: '#4F46E5', borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg)' }}>
      <BrandingSync />
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.5)' }}
          className="md:hidden"
          onClick={close}
        />
      )}

      <div className={cn(
        'fixed inset-y-0 left-0 z-50 md:static md:flex md:flex-col',
        'transition-transform duration-300 ease-in-out',
        open ? 'flex flex-col translate-x-0' : '-translate-x-full md:translate-x-0',
      )}>
        <Sidebar />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopNav />
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <LayoutInner />
    </SidebarProvider>
  );
}