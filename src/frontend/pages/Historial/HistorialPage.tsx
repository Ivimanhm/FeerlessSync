import './Historial.css';
import MatchHistory from '../../components/history/MatchHistory';
import type { FearlessSeries } from '../../types/fearless';

export default function HistorialPage({ series, onWinnerChanged }: { series: FearlessSeries; onWinnerChanged: () => Promise<void> }) {
  return (
    <>
      {series.games.length ? (
        <MatchHistory games={series.games} seriesId={series.seriesId} onWinnerChanged={onWinnerChanged} />
      ) : (
        <div class="empty-series">
          <h2>Esperando la primera partida</h2>
          <p>Las partidas confirmadas aparecerán aquí automáticamente.</p>
        </div>
      )}
    </>
  );
}
