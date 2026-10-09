import { expect } from 'vitest';
import type { SeriesRepository } from '../../server/types.ts';
import type { ChampionWinStats } from '../../shared/championWins.ts';
import { createApiHandler } from '../../server/routes/api.ts';

/** Same public statistics contract for SQLite and D1. */
export async function verifyGlobalChampionWins(repository: SeriesRepository) {
  const handler = createApiHandler(repository, {});
  const read = async () => {
    const response = await handler(new Request('http://localhost/api/stats/champions'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    return await response.json() as ChampionWinStats & { success: boolean };
  };
  expect(await read()).toEqual({ success: true, champions: [], completedGames: 0, pendingGames: 0 });
  const first = await repository.getOrCreateFearlessSeries();
  await repository.createSeries('second');
  const game = { gameNumber: 1, blueTeam: [1, 2, 3, 4, 5], redTeam: [6, 7, 8, 9, 10] };
  await repository.addGame(first.seriesId, game);
  await repository.addGame('second', game);
  await repository.addGame(first.seriesId, { gameNumber: 2, blueTeam: [11, 12, 13, 14, 15], redTeam: [16, 17, 18, 19, 20] });
  await repository.setWinner(first.seriesId, 1, 'blue');
  await repository.setWinner('second', 1, 'red');
  await repository.archiveFearlessSeries(first.seriesId);
  let stats = await read();
  expect(stats).toMatchObject({ completedGames: 2, pendingGames: 1 });
  expect(stats.champions).toEqual(Array.from({ length: 10 }, (_, index) => ({ championId: index + 1, wins: 1, gamesPlayed: 2 })));

  // Repeated saves do not increment counters; changing the winner transfers wins.
  await repository.setWinner('second', 1, 'blue');
  await repository.setWinner('second', 1, 'blue');
  stats = await read();
  expect(stats.champions).toEqual(game.blueTeam.map(championId => ({ championId, wins: 2, gamesPlayed: 2 })));
  await repository.setWinner('second', 1, 'red');
  await repository.updateGame('second', { ...game, redTeam: [21, 22, 23, 24, 25] });
  stats = await read();
  expect(stats.champions).toEqual([
    ...[21, 22, 23, 24, 25].map(championId => ({ championId, wins: 1, gamesPlayed: 1 })),
    ...game.blueTeam.map(championId => ({ championId, wins: 1, gamesPlayed: 2 })),
  ]);

  // Resetting a result excludes the entire game, including its denominator.
  await repository.setWinner(first.seriesId, 1, null);
  stats = await read();
  expect(stats).toMatchObject({ completedGames: 1, pendingGames: 2 });
  expect(stats.champions).toHaveLength(5);
  await repository.deleteGame('second', 1);
  expect(await read()).toEqual({ success: true, champions: [], completedGames: 0, pendingGames: 2 });
  await repository.clearGames(first.seriesId);
  await repository.addGame('second', game);
  await repository.setWinner('second', 1, 'red');
  expect((await read()).champions).toHaveLength(5);
  await repository.deleteSeries('second');
  expect(await read()).toEqual({ success: true, champions: [], completedGames: 0, pendingGames: 0 });
}
