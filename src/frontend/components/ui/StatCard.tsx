import { ShieldCheck, Shuffle, Sparkles } from 'lucide-preact';

interface StatCardProps {
  kind: 'games' | 'used' | 'available';
  label: string;
  value: number;
  detail: string;
}

const iconByKind = { games: Shuffle, used: ShieldCheck, available: Sparkles };

export default function StatCard({ kind, label, value, detail }: StatCardProps) {
  const Icon = iconByKind[kind];
  return (
    <article class={`stat-card stat-card--${kind}`}>
      <div class="stat-icon"><Icon size={40} strokeWidth={1.6} aria-hidden="true" /></div>
      <div class="stat-copy">
        <h2>{label}</h2>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}
