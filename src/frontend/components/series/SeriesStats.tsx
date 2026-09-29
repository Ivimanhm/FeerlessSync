import StatCard from '../ui/StatCard';
import { championCount } from '../../services/championCatalog';
import type { FearlessSeries } from '../../types/fearless';

export default function SeriesStats({ series }: { series: FearlessSeries | null }) {
  return (
    <div class="stats-grid">
      <StatCard kind="games" label="Partidas" value={series?.gamesCount ?? 0} detail="de la serie analizada" />
      <StatCard kind="used" label="Campeones utilizados" value={series?.usedChampionsCount ?? 0} detail="en esta serie" />
      <StatCard kind="available" label="Campeones disponibles" value={series?.availableChampionsCount ?? championCount} detail={`de ${series?.totalChampionsCount ?? championCount} campeones`} />
    </div>
  );
}
