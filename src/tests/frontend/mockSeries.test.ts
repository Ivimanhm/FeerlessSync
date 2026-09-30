import { afterEach, describe, expect, it } from 'vitest';
import { clearMockGames, deleteMockSeries, getMockSeries, resetMockSeries, setMockWinner } from '../../frontend/services/api/mockSeries';

afterEach(() => resetMockSeries());

describe('vista local de ejemplo', () => {
  it('permite explorar, modificar y restaurar la serie sin servidor', () => {
    resetMockSeries();
    const initial = getMockSeries('fearless-001');
    expect(initial.games).toHaveLength(3);
    expect(initial.usedChampions).toHaveLength(30);
    expect(() => getMockSeries('otra-serie')).toThrow('La serie no existe');

    setMockWinner('fearless-001', 3, 'red');
    expect(getMockSeries('fearless-001').games[2].winner).toBe('red');
    expect(clearMockGames('fearless-001')).toBe(3);
    expect(getMockSeries('fearless-001')).toMatchObject({ games: [], usedChampions: [] });

    resetMockSeries();
    expect(getMockSeries('fearless-001').games).toHaveLength(3);
    deleteMockSeries('fearless-001');
    expect(() => getMockSeries('fearless-001')).toThrow('La serie no existe');
  });
});
