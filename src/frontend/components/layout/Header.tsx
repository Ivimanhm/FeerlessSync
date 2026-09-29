import { Bell, ChevronDown, ChevronRight, Menu, UserRound } from 'lucide-preact';
import { useState } from 'preact/hooks';
import type { Page } from '../../app/navigation';

interface HeaderProps {
  activePage: Page;
  onOpenMobile: () => void;
  onGoHome: () => void;
}

export default function Header({ activePage, onOpenMobile, onGoHome }: HeaderProps) {
  const [openMenu, setOpenMenu] = useState<'notifications' | 'profile' | null>(null);

  return (
    <header class="topbar">
      <div class="topbar-left">
        <button class="mobile-menu-button" type="button" onClick={onOpenMobile} aria-label="Abrir menú"><Menu size={22} /></button>
        <nav class="breadcrumb" aria-label="Ruta de navegación">
          <button type="button" onClick={onGoHome}>Inicio</button>
          <ChevronRight size={17} strokeWidth={1.5} aria-hidden="true" />
          <span>{activePage === 'Inicio' ? 'Fearless Sync' : activePage}</span>
        </nav>
      </div>
      <div class="header-actions">
        <div class="header-control-wrap">
          <button class="notification-button" type="button" aria-label="Notificaciones" aria-expanded={openMenu === 'notifications'} onClick={() => setOpenMenu(openMenu === 'notifications' ? null : 'notifications')}>
            <Bell size={23} strokeWidth={1.6} aria-hidden="true" />
            <span class="notification-dot" />
          </button>
          {openMenu === 'notifications' && <div class="header-popover" role="status">No hay notificaciones nuevas.</div>}
        </div>
        <span class="header-divider" />
        <div class="header-control-wrap">
          <button class="profile-button" type="button" aria-expanded={openMenu === 'profile'} onClick={() => setOpenMenu(openMenu === 'profile' ? null : 'profile')}>
            <span class="avatar"><UserRound size={26} strokeWidth={1.5} aria-hidden="true" /></span>
            <span>Invocador</span>
            <ChevronDown size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
          {openMenu === 'profile' && <div class="header-popover profile-popover">PersoBuilder<br /><small>Fearless Sync v1.0.0</small></div>}
        </div>
      </div>
    </header>
  );
}
