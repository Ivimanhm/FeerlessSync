import type { ChampionWinStats } from '../../shared/championWins.ts';

// A single query reads a consistent snapshot, including games in archived series.
// Results are derived from games, so corrections and deletions need no counters.
export const championWinsQuery = `
  WITH appearances AS (
    SELECT g.series_id, g.game_number, CAST(c.value AS INTEGER) AS championId,
      CASE WHEN g.winner = 'blue' THEN 1 ELSE 0 END AS won
    FROM games g, json_each(g.blue_team) c WHERE g.winner IN ('blue', 'red')
    UNION ALL
    SELECT g.series_id, g.game_number, CAST(c.value AS INTEGER) AS championId,
      CASE WHEN g.winner = 'red' THEN 1 ELSE 0 END AS won
    FROM games g, json_each(g.red_team) c WHERE g.winner IN ('blue', 'red')
  ), per_game AS (
    SELECT series_id, game_number, championId, MAX(won) AS won
    FROM appearances GROUP BY series_id, game_number, championId
  ), counts AS (
    SELECT championId, SUM(won) AS wins, COUNT(*) AS gamesPlayed
    FROM per_game GROUP BY championId
  ), totals AS (
    SELECT COUNT(CASE WHEN winner IN ('blue', 'red') THEN 1 END) AS completedGames,
      COUNT(CASE WHEN winner IS NULL THEN 1 END) AS pendingGames FROM games
  )
  SELECT counts.championId, counts.wins, counts.gamesPlayed, totals.completedGames, totals.pendingGames
  FROM totals LEFT JOIN counts ON 1 = 1
  ORDER BY wins DESC, gamesPlayed ASC, championId ASC
`;

export interface ChampionWinsRow {
  championId: number | null;
  wins: number | null;
  gamesPlayed: number | null;
  completedGames: number;
  pendingGames: number;
}

export function statsFromRows(rows: ChampionWinsRow[]): ChampionWinStats {
  return {
    completedGames: rows[0]?.completedGames ?? 0,
    pendingGames: rows[0]?.pendingGames ?? 0,
    champions: rows.flatMap(row => row.championId === null ? [] : [{
      championId: row.championId, wins: row.wins!, gamesPlayed: row.gamesPlayed!,
    }]),
  };
}
