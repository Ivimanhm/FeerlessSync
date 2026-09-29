import { Sparkles } from 'lucide-preact';
import { useState } from 'preact/hooks';
import type { Champion } from '../../types/fearless';

interface ChampionCardProps {
  champion: Champion;
}

export default function ChampionCard({ champion }: ChampionCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = champion.name.split(/[ '\-]+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div class="champion-card" title={`${champion.name} · ${champion.roles.join(', ')}`}>
      <div class="champion-portrait">
        {champion.imageUrl && !imageFailed ? (
          <img src={champion.imageUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <span class="portrait-fallback"><Sparkles size={17} strokeWidth={1.4} /><b>{initials}</b></span>
        )}
      </div>
      <span class="champion-name">{champion.name}</span>
    </div>
  );
}
