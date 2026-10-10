import { Clock3, House, X } from 'lucide-preact';
import { useLayoutEffect, useRef } from 'preact/hooks';

import StatusBadge from '../ui/StatusBadge';

import type { Page } from '../../app/navigation';

interface SidebarProps {
  status: string;
  activePage: Page;
  onNavigate: (page: Page) => void;
  onClose: () => void;
}

const items = [
  { label: 'Campeones', Icon: House },
  { label: 'Historial', Icon: Clock3 },
] as const;

export default function Sidebar({ status, activePage, onNavigate, onClose }: SidebarProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const element = dialog.current;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
      <dialog ref={dialog} id="dashboard-menu" class="sidebar" aria-label="Menú principal"
        onCancel={event => { event.preventDefault(); onClose(); }}
        onClick={event => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
        }}>
        <div class="sidebar-brand">
          <img class="brand-mark" src="/Logo-small.png" alt="" width="43" height="43" decoding="async" />
          <div class="brand-copy">
            <strong>PersoBuilder</strong>
            <span>TU DRAFT, MIS REGLAS</span>
          </div>
          <button class="sidebar-toggle" type="button" onClick={onClose} aria-label="Cerrar menú" autoFocus>
            <X size={23} strokeWidth={1.7} aria-hidden="true" />
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
              onClick={() => { onNavigate(label); onClose(); }}
            >
              <Icon size={27} strokeWidth={1.65} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <StatusBadge status={status} />
      </dialog>
  );
}
