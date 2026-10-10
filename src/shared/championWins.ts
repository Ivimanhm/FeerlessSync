export interface ChampionWinCount {
  championId: number;
  wins: number;
  gamesPlayed: number;
}

export interface ChampionWinStats {
  champions: ChampionWinCount[];
  completedGames: number;
  pendingGames: number;
}

interface Result {
  blueTeam: number[];
  redTeam: number[];
  winner?: 'blue' | 'red' | null;
}

/** Counts only confirmed results. A champion receives at most one win per game. */
export function countChampionWins(games: Iterable<Result>): ChampionWinStats {
  const counts = new Map<number, ChampionWinCount>();
  let completedGames = 0;
  let pendingGames = 0;
  for (const game of games) {
    if (game.winner !== 'blue' && game.winner !== 'red') { pendingGames++; continue; }
    completedGames++;
    const winningTeam = new Set(game.winner === 'blue' ? game.blueTeam : game.redTeam);
    for (const championId of new Set([...game.blueTeam, ...game.redTeam])) {
      const count = counts.get(championId) ?? { championId, wins: 0, gamesPlayed: 0 };
      count.gamesPlayed++;
      if (winningTeam.has(championId)) count.wins++;
      counts.set(championId, count);
    }
  }
  const champions = [...counts.values()]
    .sort((a, b) => b.wins - a.wins || a.gamesPlayed - b.gamesPlayed || a.championId - b.championId);
  return { champions, completedGames, pendingGames };
}
