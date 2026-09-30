import type { Champion } from '../../types/fearless';
import PortraitImage from './PortraitImage';

interface ChampionCardProps {
  champion: Champion;
  eager?: boolean;
}

export default function ChampionCard({ champion, eager = false }: ChampionCardProps) {
  return (
    <div class="champion-card" title={`${champion.name} · ${champion.roles.join(', ')}`}>
      <div class="champion-portrait">
        <PortraitImage key={champion.imageUrl} name={champion.name} src={champion.imageUrl} eager={eager} />
      </div>
      <span class="champion-name">{champion.name}</span>
    </div>
  );
}
