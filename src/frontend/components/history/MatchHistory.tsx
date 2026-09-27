import { ChevronsUpDown, Clock3 } from 'lucide-preact';
import { useMemo, useState } from 'preact/hooks';
import type { Game, PlayedChampion } from '../../types/fearless';

interface MatchHistoryProps {
  games: Game[];
}

type SortKey = 'gameNumber' | 'date' | 'championId' | 'team' | 'role';

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

export default function MatchHistory({ games }: MatchHistoryProps) {
  const [sortKey, setSortKey] = useState<SortKey>('gameNumber');
  const [ascending, setAscending] = useState(true);
  const rows = useMemo(() => {
    return games.flatMap((game) => game.champions.map((champion) => ({ game, champion })));
  }, [games]);
  const sortedRows = useMemo(() => [...rows].sort((a, b) => {
    const value = (row: { game: Game; champion: PlayedChampion }) => {
      switch (sortKey) {
        case 'gameNumber': return row.game.gameNumber;
        case 'date': return row.game.date;
        case 'championId': return row.champion.championId;
        case 'team': return row.champion.team;
        case 'role': return row.champion.role;
      }
    };
    const first = value(a);
    const second = value(b);
    const comparison = typeof first === 'number' && typeof second === 'number' ? first - second : String(first).localeCompare(String(second), 'es');
    return ascending ? comparison : -comparison;
  }), [rows, sortKey, ascending]);
  const visibleRows = sortedRows;

  const changeSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) setAscending(!ascending);
    else { setSortKey(nextKey); setAscending(true); }
  };

  const heading = (label: string, key: SortKey) => (
    <button class="sort-button" type="button" onClick={() => changeSort(key)} aria-label={`Ordenar por ${label}`}>
      {label}<ChevronsUpDown size={15} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );

  return (
    <section class="content-panel history-panel" aria-labelledby="history-heading">
      <div class="panel-header history-panel-header">
        <div class="panel-title"><Clock3 size={27} strokeWidth={1.9} aria-hidden="true" /><h2 id="history-heading"><span>Historial</span> de partidas jugadas</h2></div>
      </div>
      <div class="table-scroll">
        <table class="history-table">
          <thead><tr>
            <th scope="col">{heading('Partida', 'gameNumber')}</th>
            <th scope="col">{heading('Fecha', 'date')}</th>
            <th scope="col">{heading('ID Campeón', 'championId')}</th>
            <th scope="col">Campeón</th>
            <th scope="col">{heading('Equipo', 'team')}</th>
            <th scope="col">{heading('Lado', 'role')}</th>
          </tr></thead>
          <tbody>{visibleRows.map(({ game, champion }) => (
            <tr key={`${game.gameNumber}-${champion.championId}`}>
              <td><span class="game-number">{game.gameNumber}</span></td>
              <td>{dateFormatter.format(new Date(game.date)).replace('.', '')}</td>
              <td>{champion.championId}</td>
              <td><span class="table-champion">{champion.imageUrl && <img src={champion.imageUrl} alt="" loading="lazy" />}<strong>{champion.championName}</strong></span></td>
              <td><span class="team-cell"><span class={`team-gem team-gem--${champion.team}`} />Equipo {champion.team === 'blue' ? 'Azul' : 'Rojo'}</span></td>
              <td>{champion.role ? <span class="role-cell"><span class={`role-mark role-mark--${champion.role.toLowerCase()}`}>{roleSymbols[champion.role]}</span>{champion.role}</span> : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

const roleSymbols: Record<NonNullable<PlayedChampion['role']>, string> = {
  TOP: '◩', JG: '♆', MID: '◩', ADC: '◪', SUP: '✣',
};
