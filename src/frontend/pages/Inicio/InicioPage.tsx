import './Inicio.css';
import ChampionGrid from '../../components/champions/ChampionGrid';
import SeriesStats from '../../components/series/SeriesStats';
import type { FearlessSeries } from '../../types/fearless';

export default function InicioPage({ series }: { series: FearlessSeries }) {
  return <><SeriesStats series={series} /><ChampionGrid champions={series.availableChampions} totalCount={series.availableChampionsCount} /></>;
}
