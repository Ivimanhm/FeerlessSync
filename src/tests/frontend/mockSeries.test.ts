import { afterEach, describe, expect, it } from 'vitest';
import { clearMockGames, deleteMockSeries, getMockChampionWinStats, getMockSeries, resetMockSeries, setMockWinner } from '../../frontend/services/api/mockSeries';

afterEach(() => resetMockSeries());

describe('vista local de ejemplo', () => {
  it('permite explorar, modificar y restaurar la serie sin servidor', () => {
    resetMockSeries();
    const initial = getMockSeries('fearless-001');
    expect(initial.games).toHaveLength(3);
    expect(initial.usedChampions).toHaveLength(30);
    expect(getMockChampionWinStats()).toMatchObject({ completedGames: 2, pendingGames: 1 });
    expect(getMockChampionWinStats().champions).toHaveLength(20);
    expect(() => getMockSeries('otra-serie')).toThrow('La serie no existe');

    setMockWinner('fearless-001', 3, 'red');
    expect(getMockSeries('fearless-001').games[2].winner).toBe('red');
    expect(getMockChampionWinStats()).toMatchObject({ completedGames: 3, pendingGames: 0 });
    expect(getMockChampionWinStats().champions).toHaveLength(30);
    setMockWinner('fearless-001', 1, null);
    expect(getMockChampionWinStats()).toMatchObject({ completedGames: 2, pendingGames: 1 });
    expect(getMockChampionWinStats().champions.some(champion => champion.championId === 266)).toBe(false);
    expect(clearMockGames('fearless-001')).toBe(3);
    expect(getMockSeries('fearless-001')).toMatchObject({ games: [], usedChampions: [] });
    expect(getMockChampionWinStats()).toEqual({ champions: [], completedGames: 0, pendingGames: 0 });

    resetMockSeries();
    expect(getMockSeries('fearless-001').games).toHaveLength(3);
    deleteMockSeries('fearless-001');
    expect(() => getMockSeries('fearless-001')).toThrow('La serie no existe');
    expect(getMockChampionWinStats()).toEqual({ champions: [], completedGames: 0, pendingGames: 0 });
  });
});
