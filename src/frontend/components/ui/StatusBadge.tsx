import appPackage from '../../../../package.json';
import { CloudCheck } from 'lucide-preact';

export default function StatusBadge({ status }: { status: string }) {
  return (
    <div class="sidebar-status">
      <div class={`status-pill ${status === 'API disponible' ? '' : 'status-pill--pending'}`}>
        <CloudCheck size={23} strokeWidth={2.4} aria-hidden="true" />
        <span>{status}</span>
        <span class="status-dot" />
      </div>
      <span class="status-version">Fearless Sync v{appPackage.version}</span>
    </div>
  );
}
