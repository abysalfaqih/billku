import { Link, useLocation } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/lib/sidebar-context';
import { useLogout } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface Tab {
  href: string;
  label: string;
  icon?: React.ElementType;
}

interface PageLayoutProps {
  title: string;
  description?: string;
  tabs?: Tab[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
}

function TabBar({ tabs }: { tabs: Tab[] }) {
  const pathname = useLocation().pathname;

  return (
    <div
      className="flex items-end gap-0.5 px-6 overflow-x-auto"
      style={{ borderTop: '1px solid #F1F3F7' }}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            to={tab.href}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium transition-colors',
              'border-b-2 -mb-px whitespace-nowrap',
              isActive
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {Icon && <Icon size={14} />}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function PageLayout({
  title,
  description,
  tabs,
  actions,
  children,
  noPadding = false,
}: PageLayoutProps) {
  const { toggle } = useSidebar();
  const logout = useLogout();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header
        className="shrink-0 bg-white"
        style={{
          borderBottom: tabs ? 'none' : '1px solid #E9ECF0',
          boxShadow: tabs ? 'none' : '0 1px 0 rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex items-center gap-3 px-4 md:px-6 h-14">
          {/* Mobile menu button */}
          <button
            onClick={toggle}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Menu size={18} />
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-semibold text-slate-900 truncate">{title}</h1>
            {description && (
              <p className="text-[12px] text-slate-400 leading-tight mt-0.5 hidden sm:block">
                {description}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {actions}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>

        {/* Tab bar */}
        {tabs && <TabBar tabs={tabs} />}
      </header>

      {/* Content */}
      <main className={cn('flex-1 overflow-auto', !noPadding && 'p-4 md:p-6')}>
        {children}
      </main>
    </div>
  );
}