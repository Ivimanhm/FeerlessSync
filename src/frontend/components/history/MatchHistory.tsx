import { ChevronsUpDown, Clock3, Trophy } from 'lucide-preact';
import { useMemo, useState } from 'preact/hooks';
import type { Game, PlayedChampion, Role, TeamSide } from '../../types/fearless';
import WinnerDialog from './WinnerDialog';

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

function ChampionCell({ champion }: { champion: PlayedChampion | undefined }) {
  if (!champion) return <span class="history-missing-champion">—</span>;
  return <span class="history-champion">
    {champion.imageUrl && <img src={champion.imageUrl} alt="" loading="lazy" />}
    <strong>{champion.championName}</strong>
    <small>#{champion.championId}</small>
  </span>;
}

export default function MatchHistory({ games, seriesId, onWinnerChanged }: MatchHistoryProps) {
  const [ascending, setAscending] = useState(true);
  const [selectedGameNumber, setSelectedGameNumber] = useState<number | null>(null);
  const selectedGame = games.find((game) => game.gameNumber === selectedGameNumber);
  const sortedGames = useMemo(
    () => [...games].sort((a, b) => ascending ? a.gameNumber - b.gameNumber : b.gameNumber - a.gameNumber),
    [games, ascending],
  );

  return (
    <>
    <section class="content-panel history-panel" aria-labelledby="history-heading">
      <div class="panel-header history-panel-header">
        <div class="panel-title"><Clock3 size={27} strokeWidth={1.9} aria-hidden="true" /><h2 id="history-heading"><span>Historial</span> de partidas jugadas</h2></div>
        <button class="history-sort" type="button" onClick={() => setAscending(!ascending)} aria-label="Ordenar por Partida">
          Partida <ChevronsUpDown size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div class="history-games">
        {sortedGames.map((game) => <article class="history-game" key={game.gameNumber} aria-labelledby={'game-heading-' + game.gameNumber}>
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
                <th scope="col">Posición</th>
                <th scope="col" class="team-heading--blue">Equipo Azul</th>
                <th scope="col" class="team-heading--red">Equipo Rojo</th>
              </tr></thead>
              <tbody>{roleOrder.map((role) => <tr key={role}>
                <th scope="row"><span class={'role-mark role-mark--' + role.toLowerCase()}>{roleSymbols[role]}</span>{role}</th>
                <td><ChampionCell champion={championAt(game, 'blue', role)} /></td>
                <td><ChampionCell champion={championAt(game, 'red', role)} /></td>
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

const roleSymbols: Record<Role, string> = {
  TOP: '◩', JG: '♆', MID: '◩', ADC: '◪', SUP: '✣',
};
