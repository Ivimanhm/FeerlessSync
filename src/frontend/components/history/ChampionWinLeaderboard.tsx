import { RotateCw, Trophy } from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';
import { getChampionWinStats, type ChampionLeaderboard } from '../../services/api/championWins';
import type { FearlessSeries } from '../../types/fearless';
import OrnamentalFrame from '../ui/OrnamentalFrame';
import PortraitImage from '../champions/PortraitImage';

const percentage = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 0 });

export default function ChampionWinLeaderboard({ revision }: { revision: FearlessSeries | null }) {
  const [stats, setStats] = useState<ChampionLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void getChampionWinStats().then(result => {
      if (!cancelled) setStats(result);
    }).catch(() => {
      if (!cancelled) { setStats(null); setError(true); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision, refresh]);

  return <section class="content-panel champion-win-panel" aria-labelledby="champion-wins-heading" aria-busy={loading}>
    <OrnamentalFrame />
    <header class="champion-win-header">
      <span class="champion-win-emblem"><Trophy size={24} aria-hidden="true" /></span>
      <div><h2 id="champion-wins-heading">Campeones con más victorias</h2></div>
      <button type="button" class="champion-win-refresh" aria-label="Actualizar clasificación" title="Actualizar clasificación" disabled={loading} onClick={() => setRefresh(refresh + 1)}><RotateCw size={17} aria-hidden="true" /></button>
    </header>
    {error ? <div class="champion-win-empty" role="alert"><p>No se pudo cargar la clasificación.</p><button class="history-sort" type="button" onClick={() => setRefresh(refresh + 1)}>Reintentar clasificación</button></div>
      : !stats ? <p class="champion-win-empty" role="status">Cargando victorias…</p>
        : <>
          <p class="champion-win-sample">{stats.completedGames} {stats.completedGames === 1 ? 'partida con ganador' : 'partidas con ganador'} · {stats.pendingGames} {stats.pendingGames === 1 ? 'pendiente' : 'pendientes'}</p>
          {stats.champions.length ? <>
            <div class="champion-win-columns" aria-hidden="true"><span>Campeón</span><span>Victorias</span><span>% victorias</span></div>
            <ol class="champion-win-list" aria-label="Clasificación de campeones por victorias" tabIndex={0}>
              {stats.champions.map((champion, index) => <li key={champion.id}>
                <span class="champion-win-rank" aria-label={`Posición ${index + 1}`}>{index + 1}</span>
                <PortraitImage name={champion.name} src={champion.imageUrl} eager={index < 10} />
                <div class="champion-win-name"><strong>{champion.name}</strong><small>{champion.gamesPlayed} {champion.gamesPlayed === 1 ? 'partida resuelta' : 'partidas resueltas'}</small></div>
                <strong class="champion-win-count" aria-label={`${champion.wins} ${champion.wins === 1 ? 'victoria' : 'victorias'}`}>{champion.wins}</strong>
                <span class="champion-win-rate" aria-label={`${percentage.format(champion.gamesPlayed ? champion.wins / champion.gamesPlayed : 0)} de victorias`}>{percentage.format(champion.gamesPlayed ? champion.wins / champion.gamesPlayed : 0)}</span>
              </li>)}
            </ol>
            <p class="champion-win-footnote">Orden por victorias, porcentaje y nombre. El porcentaje solo cuenta partidas con ganador.</p>
          </> : <div class="champion-win-empty"><Trophy size={30} aria-hidden="true" /><p>Aún no hay victorias registradas.</p><small>Selecciona el ganador de una partida para empezar la clasificación.</small></div>}
        </>}
  </section>;
}
