import { ChevronsUpDown, Clock3, Trophy } from 'lucide-preact';
import { useMemo, useState } from 'preact/hooks';
import type { Game, PlayedChampion, Role, TeamSide } from '../../types/fearless';
import WinnerDialog from './WinnerDialog';
import PortraitImage from '../champions/PortraitImage';

interface MatchHistoryProps {
  games: Game[];
  seriesId: string;
  onWinnerChanged: () => Promise<void>;
}

const roleOrder: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

function championAt(game: Game, team: TeamSide, role: Role): PlayedChampion | undefined {
  return game.champions.find((champion) => champion.team === team && champion.role === role);
}

function ChampionCell({ champion, side, eager }: { champion: PlayedChampion | undefined; side: TeamSide; eager: boolean }) {
  if (!champion) return <span class="history-missing-champion">—</span>;
  return <span class={'history-champion history-champion--' + side}>
    {side === 'blue' && <PortraitImage key={`${champion.championId}:${champion.imageUrl}`} name={champion.championName} src={champion.imageUrl} eager={eager} />}
    <strong>{champion.championName}</strong>
    {side === 'red' && <PortraitImage key={`${champion.championId}:${champion.imageUrl}`} name={champion.championName} src={champion.imageUrl} eager={eager} />}
  </span>;
}

export default function MatchHistory({ games, seriesId, onWinnerChanged }: MatchHistoryProps) {
  const [ascending, setAscending] = useState(false);
  const [selectedGameNumber, setSelectedGameNumber] = useState<number | null>(null);
  const selectedGame = games.find((game) => game.gameNumber === selectedGameNumber);
  const sortedGames = useMemo(
    () => [...games].sort((a, b) => (ascending ? 1 : -1) * (Date.parse(a.date) - Date.parse(b.date) || a.gameNumber - b.gameNumber)),
    [games, ascending],
  );

  return (
    <>
    <section class="content-panel history-panel" aria-labelledby="history-heading">
      <div class="panel-header history-panel-header">
        <div class="panel-title"><Clock3 size={27} strokeWidth={1.9} aria-hidden="true" /><h2 id="history-heading"><span>Historial</span> de partidas jugadas</h2></div>
        <button class="history-sort" type="button" onClick={() => setAscending(!ascending)} aria-label="Cambiar orden del historial" title={ascending ? 'Más antiguas primero' : 'Más recientes primero'}>
          {ascending ? 'Más antiguas primero' : 'Más recientes primero'} <ChevronsUpDown size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div class="history-games">
        {sortedGames.map((game, index) => <article class="history-game" key={game.gameNumber} aria-labelledby={'game-heading-' + game.gameNumber}>
          <header class="history-game-header">
            <div>
              <h3 id={'game-heading-' + game.gameNumber}>Partida {game.gameNumber}</h3>
              <time dateTime={game.date}>{dateFormatter.format(new Date(game.date)).replace('.', '')}</time>
            </div>
            <div class="history-winner-actions">
              <span class={'winner-status winner-status--' + (game.winner ?? 'pending')}>
                {game.winner && <Trophy size={16} aria-hidden="true" />}
                {game.winner ? 'Ganador: Equipo ' + (game.winner === 'blue' ? 'Azul' : 'Rojo') : 'Ganador pendiente'}
              </span>
              <button type="button" class="winner-edit" onClick={() => setSelectedGameNumber(game.gameNumber)} aria-label={(game.winner ? 'Cambiar ganador' : 'Seleccionar ganador') + ' de la partida ' + game.gameNumber}>
                {game.winner ? 'Cambiar ganador' : 'Seleccionar ganador'}
              </button>
            </div>
          </header>
          <div class="table-scroll">
            <table class="history-table" aria-label={'Partida ' + game.gameNumber + ': equipos por posición'}>
              <thead><tr>
                <th scope="col" class="team-heading--blue"><span class="history-team-heading"><span class="history-team-gem" />Equipo Azul</span></th>
                <th scope="col" class="history-position-heading"><span class="sr-only">Posición</span></th>
                <th scope="col" class="team-heading--red"><span class="history-team-heading"><span class="history-team-gem" />Equipo Rojo</span></th>
              </tr></thead>
              <tbody>{roleOrder.map((role) => <tr key={role}>
                <td><ChampionCell champion={championAt(game, 'blue', role)} side="blue" eager={index === 0} /></td>
                <th scope="row" class="history-position"><img src={'/icons/roles/' + roleAssets[role] + '.svg'} alt="" /><small>{role}</small></th>
                <td><ChampionCell champion={championAt(game, 'red', role)} side="red" eager={index === 0} /></td>
              </tr>)}</tbody>
            </table>
          </div>
        </article>)}
      </div>
    </section>
    {selectedGame && <WinnerDialog key={selectedGame.gameNumber} seriesId={seriesId} game={selectedGame} onClose={() => setSelectedGameNumber(null)} onSaved={onWinnerChanged} />}
    </>
  );
}

const roleAssets: Record<Role, string> = {
  TOP: 'top', JG: 'jungle', MID: 'mid', ADC: 'adc', SUP: 'support',
};
