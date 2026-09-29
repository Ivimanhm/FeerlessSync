import { Clock3, House, Menu, X } from 'lucide-preact';

import StatusBadge from '../ui/StatusBadge';

import type { Page } from '../../app/navigation';

interface SidebarProps {
  status: string;
  activePage: Page;
  onNavigate: (page: Page) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const items = [
  { label: 'Inicio', Icon: House },
  { label: 'Historial', Icon: Clock3 },
] as const;

export default function Sidebar({ status, activePage, onNavigate, mobileOpen, onCloseMobile, collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <>
      {mobileOpen && <button class="sidebar-scrim" type="button" onClick={onCloseMobile} aria-label="Cerrar menú" />}
      <aside class={`sidebar ${mobileOpen ? 'sidebar--open' : ''} ${collapsed ? 'sidebar--collapsed' : ''}`}>
        <div class="sidebar-brand">
          <img class="brand-mark" src="/Logo.png?v=20260927" alt="" />
          <div class="brand-copy">
            <strong>PersoBuilder</strong>
            <span>TU DRAFT, MIS REGLAS</span>
          </div>
          <button class="sidebar-toggle desktop-sidebar-toggle" type="button" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} title={collapsed ? 'Expandir menú' : 'Contraer menú'}>
            <Menu size={22} strokeWidth={1.7} />
          </button>
          <button class="sidebar-toggle mobile-sidebar-close" type="button" onClick={onCloseMobile} aria-label="Cerrar menú">
            <X size={23} strokeWidth={1.7} />
          </button>
        </div>
        <nav class="sidebar-nav" aria-label="Navegación principal">
          {items.map(({ label, Icon }) => (
            <button
              key={label}
              type="button"
              class={`nav-item ${activePage === label ? 'nav-item--active' : ''}`}
              aria-current={activePage === label ? 'page' : undefined}
              title={label}
              onClick={() => { onNavigate(label); onCloseMobile(); }}
            >
              <Icon size={27} strokeWidth={1.65} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <StatusBadge status={status} />
      </aside>
    </>
  );
}
