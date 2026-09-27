import './Historial.css';
import MatchHistory from '../../components/history/MatchHistory';
import UsedChampions from '../../components/history/UsedChampions';
import type { FearlessSeries } from '../../types/fearless';

export default function HistorialPage({ series }: { series: FearlessSeries }) {
  return (
    <>
      {series.games.length ? (
        <MatchHistory games={series.games} />
      ) : (
        <div class="empty-series">
          <h2>Esperando la primera partida</h2>
          <p>Las partidas confirmadas aparecerán aquí automáticamente.</p>
        </div>
      )}
      <UsedChampions ids={series.usedChampions} />
    </>
  );
}
