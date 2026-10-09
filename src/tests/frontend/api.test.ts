import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFearlessSeries, getLatestFearlessSeriesId, mapStoredSeries } from '../../frontend/services/api/series';
import { getChampionCatalog } from '../../frontend/services/championCatalog';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('servicio de series', () => {
  it('elige el mayor número Fearless, sin depender del orden del listado', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      total: 4,
      series: [
        { seriesId: 'fearless-9' },
        { seriesId: 'fearless-10' },
        { seriesId: 'custom-99' },
        { seriesId: 'fearless-2' },
      ],
    })));
    vi.stubGlobal('fetch', fetcher);

    await expect(getLatestFearlessSeriesId()).resolves.toBe('fearless-10');
    expect(String(fetcher.mock.calls[0][0])).toContain('/api/series?limit=100&offset=0');
  });

  it('normaliza el ID buscado y devuelve una serie utilizable', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ success: true, seriesId: 'fearless-42', games: [], usedChampions: [] })));
    vi.stubGlobal('fetch', fetcher);
    const series = await getFearlessSeries('  fearless-42  ');
    expect(series.seriesId).toBe('fearless-42');
    expect(String(fetcher.mock.calls[0][0])).toContain('/api/series/fearless-42');
    expect(series.games).toHaveLength(series.gamesCount);
    expect(series.availableChampions.length).toBeGreaterThan(0);
  });

  it('rechaza un ID vacío', async () => {
    await expect(getFearlessSeries('   ')).rejects.toThrow('vacío');
  });

  it('convierte una partida real en diez campeones con equipos y disponibilidad', async () => {
    const catalog = await getChampionCatalog();
    const usedChampions = [103, 64, 7, 222, 412, 266, 254, 238, 81, 111];
    const series = mapStoredSeries({
      seriesId: 'local-1',
      usedChampions,
      games: [{
        gameNumber: 1,
        blueTeam: usedChampions.slice(0, 5),
        redTeam: usedChampions.slice(5),
        winner: 'red',
        createdAt: '2026-09-23T21:33:00.000Z',
      }],
    }, catalog);

    expect(series.gamesCount).toBe(1);
    expect(series.games[0].champions).toHaveLength(10);
    expect(series.games[0].champions.slice(0, 5).every((champion) => champion.team === 'blue')).toBe(true);
    expect(series.games[0].champions.slice(5).every((champion) => champion.team === 'red')).toBe(true);
    expect(series.games[0].winner).toBe('red');
    expect(series.games[0].champions.map((champion) => champion.role)).toEqual(['TOP', 'JG', 'MID', 'ADC', 'SUP', 'TOP', 'JG', 'MID', 'ADC', 'SUP']);
    expect(series.usedChampionsCount).toBe(10);
    expect(series.availableChampionsCount).toBe(catalog.length - usedChampions.length);
    expect(series.availableChampions.some((champion) => champion.id === 103)).toBe(false);
  });

  it('consulta la API configurada y el catálogo versionado para una serie real', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8787');
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      urls.push(url);
      const body = { success: true, seriesId: 'serie-001', usedChampions: [103, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009], games: [{
            gameNumber: 1,
            blueTeam: [103, 1001, 1002, 1003, 1004],
            redTeam: [1005, 1006, 1007, 1008, 1009],
            createdAt: '2026-09-23T21:33:00Z',
          }] };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));

    const series = await getFearlessSeries('serie-001');
    expect(urls).toContain('http://127.0.0.1:8787/api/series/serie-001');
    expect(urls).toHaveLength(1);
    expect(series.totalChampionsCount).toBe(173);
    expect(series.availableChampionsCount).toBe(172);
    expect(series.games[0].champions).toHaveLength(10);
  });

});
