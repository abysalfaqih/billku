import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';

// Semua halaman di-lazy-load per-rute, meniru perilaku code-splitting otomatis
// per-halaman yang dulu dilakukan Next.js App Router. Ini juga membuat
// <ChunkErrorReload /> (lihat components/chunk-error-reload.tsx) tetap relevan:
// dia menangani ChunkLoadError yang bisa muncul dari import() dinamis di sini,
// sama seperti tujuannya di versi Next.js dulu.

// ─── Public ───────────────────────────────────────────────────────────────────
const RootPage = lazy(() => import('@/pages/index'));
const LoginPage = lazy(() => import('@/pages/login/page'));
const PortalPage = lazy(() => import('@/pages/portal/slug/page'));

// ─── Dashboard shell ────────────────────────────────────────────────────────
const DashboardLayout = lazy(() => import('@/pages/_authenticated/layout'));
const DashboardPage = lazy(() => import('@/pages/_authenticated/dashboard/page'));
const ActivityLogsPage = lazy(() => import('@/pages/_authenticated/activity-logs/page'));
const BillingPage = lazy(() => import('@/pages/_authenticated/billing/page'));
const CompanyProfilePage = lazy(() => import('@/pages/_authenticated/company-profile/page'));
const CustomersPage = lazy(() => import('@/pages/_authenticated/customers/page'));
const CustomerDetailPage = lazy(() => import('@/pages/_authenticated/customers/id/page'));
const MonitoringPage = lazy(() => import('@/pages/_authenticated/monitoring/page'));
const LiveSessionPage = lazy(() => import('@/pages/_authenticated/monitoring/live/page'));
const PackagesPage = lazy(() => import('@/pages/_authenticated/packages/page'));
const PaymentsPage = lazy(() => import('@/pages/_authenticated/payments/page'));
const ReportsPage = lazy(() => import('@/pages/_authenticated/reports/page'));
const SubscriptionsPage = lazy(() => import('@/pages/_authenticated/subscriptions/page'));
const TenantInvoicesPage = lazy(() => import('@/pages/_authenticated/tenant-invoices/page'));
const TenantsPage = lazy(() => import('@/pages/_authenticated/tenants/page'));
const UsersPage = lazy(() => import('@/pages/_authenticated/users/page'));
const WhatsappPage = lazy(() => import('@/pages/_authenticated/whatsapp/page'));

// ─── Network sub-shell (punya tab-bar sendiri, dulu app/(dashboard)/network) ──
const NetworkLayout = lazy(() => import('@/pages/_authenticated/network/layout'));
const NetworkIndexRedirect = lazy(() => import('@/pages/_authenticated/network/page'));
const MikrotikPage = lazy(() => import('@/pages/_authenticated/network/mikrotik/page'));
const IpPoolsPage = lazy(() => import('@/pages/_authenticated/network/ip-pools/page'));
const AreasPage = lazy(() => import('@/pages/_authenticated/network/areas/page'));

const NotFoundPage = lazy(() => import('@/pages/not-found'));

function RouteFallback() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        width: 32, height: 32, border: '3px solid var(--border)',
        borderTopColor: '#4F46E5', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  );
}

// Bungkus tiap komponen lazy dengan Suspense-nya sendiri, supaya saat pindah
// rute di dalam dashboard, hanya area kontennya yang menunjukkan loading —
// sidebar & top-nav (yang sudah dimuat) tidak ikut hilang/remount.
function withSuspense(Component: ComponentType) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: withSuspense(RootPage) },
  { path: '/login', element: withSuspense(LoginPage) },
  { path: '/portal/:slug', element: withSuspense(PortalPage) },
  {
    element: withSuspense(DashboardLayout),
    children: [
      { path: '/dashboard', element: withSuspense(DashboardPage) },
      { path: '/activity-logs', element: withSuspense(ActivityLogsPage) },
      { path: '/billing', element: withSuspense(BillingPage) },
      { path: '/company-profile', element: withSuspense(CompanyProfilePage) },
      { path: '/customers', element: withSuspense(CustomersPage) },
      { path: '/customers/:id', element: withSuspense(CustomerDetailPage) },
      { path: '/monitoring', element: withSuspense(MonitoringPage) },
      { path: '/monitoring/live', element: withSuspense(LiveSessionPage) },
      { path: '/network', element: withSuspense(NetworkIndexRedirect) },
      {
        element: withSuspense(NetworkLayout),
        children: [
          { path: '/network/mikrotik', element: withSuspense(MikrotikPage) },
          { path: '/network/ip-pools', element: withSuspense(IpPoolsPage) },
          { path: '/network/areas', element: withSuspense(AreasPage) },
        ],
      },
      { path: '/packages', element: withSuspense(PackagesPage) },
      { path: '/payments', element: withSuspense(PaymentsPage) },
      { path: '/reports', element: withSuspense(ReportsPage) },
      { path: '/subscriptions', element: withSuspense(SubscriptionsPage) },
      { path: '/tenant-invoices', element: withSuspense(TenantInvoicesPage) },
      { path: '/tenants', element: withSuspense(TenantsPage) },
      { path: '/users', element: withSuspense(UsersPage) },
      { path: '/whatsapp', element: withSuspense(WhatsappPage) },
    ],
  },
  { path: '*', element: withSuspense(NotFoundPage) },
]);
