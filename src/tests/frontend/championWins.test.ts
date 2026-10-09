import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChampionWinStats } from '../../frontend/services/api/championWins';

vi.mock('../../frontend/services/api/mode', () => ({ mockMode: false }));
vi.mock('../../frontend/services/championCatalog', () => ({ getChampionCatalog: async () => [
  { id: 266, name: 'Aatrox', roles: ['TOP'], imageUrl: '/champions/Aatrox.jpg' },
  { id: 103, name: 'Ahri', roles: ['MID'], imageUrl: '/champions/Ahri.jpg' },
  { id: 12, name: 'Alistar', roles: ['SUP'], imageUrl: '/champions/Alistar.jpg' },
] }));

function respond(body: unknown) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('clasificación global de campeones', () => {
  it('prioriza victorias, desempata por porcentaje y nombre, y conserva IDs desconocidos', async () => {
    const fetchMock = respond({ completedGames: 8, pendingGames: 3, champions: [
      { championId: 12, wins: 1, gamesPlayed: 2 },
      { championId: 999, wins: 1, gamesPlayed: 4 },
      { championId: 266, wins: 2, gamesPlayed: 8 },
      { championId: 103, wins: 1, gamesPlayed: 1 },
    ] });
    const stats = await getChampionWinStats();
    expect(stats.champions.map(champion => champion.name)).toEqual(['Aatrox', 'Ahri', 'Alistar', 'Campeón 999']);
    expect(stats.champions[0]).toMatchObject({ id: 266, wins: 2, gamesPlayed: 8, imageUrl: '/champions/Aatrox.jpg' });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/stats\/champions$/);
    respond({ completedGames: 2, pendingGames: 0, champions: [
      { championId: 12, wins: 1, gamesPlayed: 2 }, { championId: 266, wins: 1, gamesPlayed: 2 },
    ] });
    expect((await getChampionWinStats()).champions.map(champion => champion.name)).toEqual(['Aatrox', 'Alistar']);
  });

  it('admite una clasificación vacía con partidas pendientes', async () => {
    respond({ completedGames: 0, pendingGames: 4, champions: [] });
    expect(await getChampionWinStats()).toEqual({ completedGames: 0, pendingGames: 4, champions: [] });
  });

  it.each([
    { completedGames: 1, pendingGames: 0, champions: [{ championId: 103, wins: 2, gamesPlayed: 1 }] },
    { completedGames: 1, pendingGames: 0, champions: [{ championId: 103, wins: 1, gamesPlayed: 2 }] },
    { completedGames: 1, pendingGames: -1, champions: [] },
    { completedGames: 1, pendingGames: 0, champions: [{ championId: 103, wins: 1, gamesPlayed: 1 }, { championId: 103, wins: 1, gamesPlayed: 1 }] },
  ])('rechaza estadísticas inconsistentes: %j', async body => {
    respond(body);
    await expect(getChampionWinStats()).rejects.toThrow('estadísticas de victorias no válidas');
  });
});
