import { createContext, useContext, useState, useCallback } from 'react';

interface SidebarCtx {
  open: boolean;       // mobile: show/hide
  collapsed: boolean;  // desktop: expand/collapse
  toggle: () => void;
  close: () => void;
  toggleCollapse: () => void;
}

const Ctx = createContext<SidebarCtx>({
  open: false, collapsed: false,
  toggle: () => {}, close: () => {}, toggleCollapse: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const toggle = useCallback(() => setOpen((p) => !p), []);
  const close = useCallback(() => setOpen(false), []);
  const toggleCollapse = useCallback(() => setCollapsed((p) => !p), []);

  return (
    <Ctx.Provider value={{ open, collapsed, toggle, close, toggleCollapse }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSidebar = () => useContext(Ctx);