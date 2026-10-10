import './Historial.css';
import MatchHistory from '../../components/history/MatchHistory';
import type { FearlessSeries } from '../../types/fearless';
import { Clock3, Hourglass, Trophy } from 'lucide-preact';
import ChampionWinLeaderboard from '../../components/history/ChampionWinLeaderboard';
import OrnamentalFrame from '../../components/ui/OrnamentalFrame';
import { useLayoutEffect, useRef } from 'preact/hooks';

export default function HistorialPage({ series, loading, onWinnerChanged }: { series: FearlessSeries | null; loading: boolean; onWinnerChanged: () => Promise<void> }) {
  const championColumn = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const column = championColumn.current;
    if (!column) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const bounds = column.getBoundingClientRect();
      column.style.setProperty('--champion-panel-top', `${Math.max(20, bounds.top)}px`);
      column.style.setProperty('--champion-panel-left', `${bounds.left}px`);
      column.style.setProperty('--champion-panel-width', `${bounds.width}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    // Header wrapping, font loading and stylesheet updates can move the row
    // without a window resize or a component render.
    const observer = new ResizeObserver(schedule);
    const layout = column.parentElement;
    if (layout) observer.observe(layout);
    if (layout?.parentElement) observer.observe(layout.parentElement);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
    };
  });
  const completed = series?.games.filter(game => game.winner !== null).length ?? 0;
  const summaries = [
    { label: 'Partidas de esta serie', value: series?.gamesCount ?? 0, Icon: Clock3, color: 'gold' },
    { label: 'Resultados guardados', value: completed, Icon: Trophy, color: 'blue' },
    { label: 'Ganadores pendientes', value: (series?.gamesCount ?? 0) - completed, Icon: Hourglass, color: 'purple' },
  ];
  return (
    <>
      {series && <div class="history-summary" aria-label="Resumen de la serie">
        {summaries.map(({ label, value, Icon, color }) => <article key={label} class={`history-summary-card history-summary-card--${color}`}>
          <OrnamentalFrame />
          <span class="history-summary-icon"><Icon size={27} aria-hidden="true" /></span>
          <div><h2>{label}</h2><strong>{value}</strong></div>
        </article>)}
      </div>}
      <div class="history-layout">
        <div class="history-matches" aria-busy={loading}>
          {series?.games.length ? <MatchHistory games={series.games} seriesId={series.seriesId} onWinnerChanged={onWinnerChanged} />
            : loading ? <div class="empty-series" role="status">Cargando partidas…</div>
              : <div class="empty-series">
                <h2>{series ? 'Esperando la primera partida' : 'No hay datos de esta serie'}</h2>
                <p>Las partidas confirmadas aparecerán aquí automáticamente.</p>
              </div>}
        </div>
        <div class="champion-win-column" ref={championColumn}><ChampionWinLeaderboard revision={series} /></div>
      </div>
    </>
  );
}
