import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFearlessApiClient, FearlessApiError } from '../../frontend/services/api/client';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

afterEach(() => vi.unstubAllGlobals());

describe('cliente de API Fearless', () => {
  it('comprueba health y diferencia un 503 de un servicio sano', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ success: false, error: 'database_unavailable' }, 503));
    vi.stubGlobal('fetch', fetchMock);
    const client = createFearlessApiClient({ baseUrl: 'https://example.test/' });

    expect(await client.health()).toBe(true);
    expect(await client.health()).toBe(false);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://example.test/api/health',
      'https://example.test/api/health',
    ]);
  });

  it('codifica el ID de serie y lee IDs únicos de campeones', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ seriesId: 'A/B', games: [] }))
      .mockResolvedValueOnce(jsonResponse({ usedChampions: [103, 64] }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createFearlessApiClient({ baseUrl: 'https://example.test' });

    expect(await client.getSeries('A/B')).toEqual({ seriesId: 'A/B', games: [] });
    expect(await client.getUsedChampionIds('A/B')).toEqual([103, 64]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://example.test/api/series/A%2FB',
      'https://example.test/api/series/A%2FB/used-champions',
    ]);
  });

  it('crea series y partidas sin token y envía el cuerpo JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ success: true }, 201));
    vi.stubGlobal('fetch', fetchMock);
    const input = { gameNumber: 1, blueTeam: [103, 64, 7, 222, 412], redTeam: [266, 254, 238, 81, 111] } as const;

    const anonymousClient = createFearlessApiClient({ baseUrl: 'https://example.test' });
    await anonymousClient.createSeries({ seriesId: 'serie-1' });
    await anonymousClient.createGame('serie-1', { ...input, blueTeam: [...input.blueTeam], redTeam: [...input.redTeam] });
    const [seriesUrl, seriesOptions] = fetchMock.mock.calls[0];
    expect(seriesUrl).toBe('https://example.test/api/series');
    expect(JSON.parse(String(seriesOptions?.body))).toEqual({ seriesId: 'serie-1' });
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe('https://example.test/api/series/serie-1/games');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(String(options?.body))).toEqual(input);
    expect(new Headers(seriesOptions?.headers).get('Authorization')).toBeNull();
    expect(new Headers(options?.headers).get('Authorization')).toBeNull();
  });

  it('rechaza una respuesta inválida de campeones usados', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ usedChampions: ['103'] })));
    const client = createFearlessApiClient({ baseUrl: 'https://example.test' });
    await expect(client.getUsedChampionIds('serie-1')).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('conserva el código de error estable de la API', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ success: false, error: 'champion_already_used', message: 'Campeón repetido' }, 409)));
    const client = createFearlessApiClient({ baseUrl: 'https://example.test' });

    await expect(client.getSeries('serie-1')).rejects.toEqual(new FearlessApiError(409, 'champion_already_used', 'Campeón repetido'));
  });

  it('lee el recuento de series sin descargar el listado', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ success: true, count: 12 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createFearlessApiClient({ baseUrl: 'https://example.test' });

    expect(await client.getSeriesCount()).toBe(12);
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.test/api/series/count');
  });

  it('rechaza recuentos negativos o no enteros', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ success: true, count: -1 })));
    const client = createFearlessApiClient({ baseUrl: 'https://example.test' });
    await expect(client.getSeriesCount()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('expone las rutas de consulta, corrección, borrado, ganador y eventos', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createFearlessApiClient({ baseUrl: 'https://example.test', getAccessToken: () => 'test-token' });

    await client.listSeries(10, 20);
    await client.getGames('serie-1');
    await client.getGame('serie-1', 3);
    await client.updateGame('serie-1', 3, { blueTeam: [1, 2, 3, 4, 5] });
    await client.setWinner('serie-1', 3, { winner: 'blue' });
    await client.getAvailability('serie-1');
    await client.getEvents('serie-1', 5, 10);
    await client.deleteGame('serie-1', 3);
    await client.deleteSeries('serie-1');

    expect(fetchMock.mock.calls.map(([url, options]) => [url, options?.method ?? 'GET'])).toEqual([
      ['https://example.test/api/series?limit=10&offset=20', 'GET'],
      ['https://example.test/api/series/serie-1/games', 'GET'],
      ['https://example.test/api/series/serie-1/games/3', 'GET'],
      ['https://example.test/api/series/serie-1/games/3', 'PATCH'],
      ['https://example.test/api/series/serie-1/games/3/winner', 'PUT'],
      ['https://example.test/api/series/serie-1/availability', 'GET'],
      ['https://example.test/api/series/serie-1/events?limit=5&offset=10', 'GET'],
      ['https://example.test/api/series/serie-1/games/3', 'DELETE'],
      ['https://example.test/api/series/serie-1', 'DELETE'],
    ]);
    expect(new Headers(fetchMock.mock.calls[3][1]?.headers).get('Authorization')).toBeNull();
    for (const index of [4, 7, 8]) {
      expect(new Headers(fetchMock.mock.calls[index][1]?.headers).get('Authorization')).toBe('Bearer test-token');
    }
  });
});
