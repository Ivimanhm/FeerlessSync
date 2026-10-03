// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiHandler } from '../../server/routes/api.ts';
import { SqliteSeriesRepository } from '../../server/repositories/sqliteRepository.ts';
import { createLocalServer } from '../../server/nodeServer.ts';
import type { ChampionCatalogProvider } from '../../server/types.ts';

const databases: DatabaseSync[] = [];
const temporaryDirectories: string[] = [];
const token = 'invalid-admin-token';
const adminToken = 'local-test-admin';

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function setup(catalogProvider: ChampionCatalogProvider = { getCatalog: async () => ({ version: 'test-1', championIds: Array.from({ length: 500 }, (_, index) => index + 1) }) }) {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  const repository = new SqliteSeriesRepository(database);
  const handler = createApiHandler(repository, { adminToken, allowedOrigin: 'http://localhost:5173', catalogProvider });
  const call = (path: string, method = 'GET', body?: unknown, authorized: boolean | 'admin' = false) => handler(new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(authorized ? { Authorization: `Bearer ${authorized === 'admin' ? adminToken : token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  return { database, repository, handler, call };
}

const firstGame = {
  gameNumber: 1,
  blueTeam: [103, 64, 7, 222, 412],
  redTeam: [266, 254, 238, 81, 111],
};
const secondGame = { gameNumber: 2, blueTeam: [20, 21, 22, 23, 24], redTeam: [25, 26, 27, 28, 29] };

describe('API local de series', () => {
  it('usa /fearless para consultar y guardar; archiva solo cuando quedan menos de diez', async () => {
    const championIds = Array.from({ length: 20 }, (_, index) => index + 1);
    const { call, repository, database } = setup({ getCatalog: async () => ({ version: '20', championIds }) });
    const initial = await (await call('/api/fearless')).json() as { seriesId: string };
    expect(initial).toMatchObject({ games: [], availableChampionsCount: 20, nextGameNumber: 1 });
    expect(await (await call('/api/fearless')).json()).toMatchObject({ seriesId: initial.seriesId });
    const first = { seriesId: initial.seriesId, gameNumber: 1, blueTeam: [1, 2, 3, 4, 5], redTeam: [6, 7, 8, 9, 10] };
    expect(await (await call('/api/fearless', 'POST', first)).json()).toMatchObject({ seriesId: initial.seriesId, seriesArchived: false });
    expect(await (await call('/api/fearless')).json()).toMatchObject({ seriesId: initial.seriesId, availableChampionsCount: 10, nextGameNumber: 2 });
    const second = { seriesId: initial.seriesId, gameNumber: 2, blueTeam: [11, 12, 13, 14, 15], redTeam: [16, 17, 18, 19, 20] };
    const saved = await call('/api/fearless', 'POST', second);
    expect(saved.status).toBe(201);
    expect(await saved.json()).toMatchObject({ seriesId: initial.seriesId, seriesArchived: true });
    const next = await (await call('/api/fearless')).json() as { seriesId: string };
    expect(next.seriesId).not.toBe(initial.seriesId);
    expect(next).toMatchObject({ availableChampionsCount: 20, usedChampions: [], nextGameNumber: 1 });
    expect(repository.getSeries(initial.seriesId)?.games).toHaveLength(2);
    expect(database.prepare('SELECT archived_at FROM fearless_series WHERE series_id = ?').get(initial.seriesId)).toMatchObject({ archived_at: expect.any(String) });
    expect(await (await call('/api/fearless', 'POST', second)).json()).toMatchObject({ error: 'fearless_series_changed' });
    expect(repository.getSeries(next.seriesId)?.games).toHaveLength(0);
    expect((await call('/api/fearless', 'POST', { ...first, seriesId: next.seriesId })).status).toBe(201);
    const reloaded = createApiHandler(new SqliteSeriesRepository(database), { catalogProvider: { getCatalog: async () => ({ version: '20', championIds }) } });
    expect(await (await reloaded(new Request('http://localhost/api/fearless'))).json()).toMatchObject({ seriesId: next.seriesId, nextGameNumber: 2 });
    repository.clearGames(initial.seriesId);
    expect(await (await call('/api/fearless')).json()).toMatchObject({ seriesId: next.seriesId });
  });

  it('comparte una única serie activa en consultas simultáneas', async () => {
    const { call, repository } = setup();
    const results = await Promise.all(Array.from({ length: 5 }, () => call('/api/fearless')));
    const bodies = await Promise.all(results.map((response) => response.json())) as Array<{ seriesId: string }>;
    expect(new Set(bodies.map((body) => body.seriesId)).size).toBe(1);
    expect(repository.countSeries()).toBe(1);
  });

  it('no crea series con el catálogo caído y rechaza drafts inválidos', async () => {
    const offline = setup({ getCatalog: async () => { throw new Error('offline'); } });
    expect((await offline.call('/api/fearless')).status).toBe(503);
    expect(offline.repository.countSeries()).toBe(0);
    const { call, repository } = setup();
    const initial = await (await call('/api/fearless')).json() as { seriesId: string };
    expect((await call('/api/fearless', 'POST', firstGame)).status).toBe(400);
    const unknown = await call('/api/fearless', 'POST', { ...firstGame, seriesId: initial.seriesId, blueTeam: [9999, 1, 2, 3, 4] });
    expect(await unknown.json()).toMatchObject({ error: 'unknown_champion_ids' });
    expect(repository.getSeries(initial.seriesId)?.games).toHaveLength(0);
  });

  it('mantiene la serie con exactamente diez campeones disponibles', async () => {
    const championIds = Array.from({ length: 20 }, (_, index) => index + 1);
    const { call, repository } = setup({ getCatalog: async () => ({ version: 'boundary', championIds }) });
    repository.createSeries('boundary');
    repository.addGame('boundary', { gameNumber: 1, blueTeam: [1, 2, 3, 4, 5], redTeam: [6, 7, 8, 9, 10] });
    const result = await call('/api/series/boundary/prepare', 'POST');
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ seriesId: 'boundary', seriesChanged: false, canStartGame: true, availableChampionsCount: 10, nextGameNumber: 2 });
    expect(repository.countSeries()).toBe(1);
  });

  it.each(Array.from({ length: 10 }, (_, index) => index))('cambia de serie con %i campeones restantes y reutiliza el nuevo ID', async (remaining) => {
    const championIds = Array.from({ length: 10 + remaining }, (_, index) => index + 1);
    const { call, repository } = setup({ getCatalog: async () => ({ version: 'boundary', championIds }) });
    repository.createSeries('exhausted');
    repository.addGame('exhausted', { gameNumber: 1, blueTeam: [1, 2, 3, 4, 5], redTeam: [6, 7, 8, 9, 10] });
    const availability = await (await call('/api/series/exhausted/availability')).json();
    expect(availability).toMatchObject({ canStartGame: false, availableChampionsCount: remaining });
    const responses = await Promise.all([call('/api/series/exhausted/prepare', 'POST'), call('/api/series/exhausted/prepare', 'POST')]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const [first, second] = await Promise.all(responses.map((response) => response.json())) as Array<{ seriesId: string }>;
    expect(first).toMatchObject({ previousSeriesId: 'exhausted', seriesChanged: true, usedChampions: [], availableChampions: championIds, nextGameNumber: 1 });
    expect(first.seriesId).not.toBe('exhausted');
    expect(second.seriesId).toBe(first.seriesId);
    expect(repository.countSeries()).toBe(2);
    expect(repository.getSeries('exhausted')?.games).toHaveLength(1);
    expect(await (await call(`/api/series/${first.seriesId}/prepare`, 'POST')).json()).toMatchObject({ seriesId: first.seriesId, seriesChanged: false });
  });

  it('resuelve continuaciones agotadas y permite reutilizar campeones en la nueva serie', async () => {
    const championIds = Array.from({ length: 173 }, (_, index) => index + 1);
    const { call, repository } = setup({ getCatalog: async () => ({ version: '173', championIds }) });
    repository.createSeries('long-series');
    for (let gameNumber = 1; gameNumber <= 17; gameNumber++) {
      const ids = Array.from({ length: 10 }, (_, index) => (gameNumber - 1) * 10 + index + 1);
      repository.addGame('long-series', { gameNumber, blueTeam: ids.slice(0, 5), redTeam: ids.slice(5) });
    }
    const first = await (await call('/api/series/long-series/prepare', 'POST')).json() as { seriesId: string };
    expect(first).toMatchObject({ seriesChanged: true, availableChampionsCount: 173, nextGameNumber: 1 });
    for (const game of repository.getSeries('long-series')!.games) {
      expect((await call(`/api/series/${first.seriesId}/games`, 'POST', game)).status).toBe(201);
    }
    const second = await (await call('/api/series/long-series/prepare', 'POST')).json() as { seriesId: string };
    expect(second.seriesId).not.toBe(first.seriesId);
    expect(repository.countSeries()).toBe(3);
    expect(await (await call('/api/series/long-series/prepare', 'POST')).json()).toMatchObject({ seriesId: second.seriesId });
  });

  it('no crea series cuando falla el catálogo, hay IDs desconocidos o falta la serie', async () => {
    const offline = setup({ getCatalog: async () => { throw new Error('offline'); } });
    offline.repository.createSeries('offline');
    expect((await offline.call('/api/series/offline/prepare', 'POST')).status).toBe(503);
    expect(offline.repository.countSeries()).toBe(1);
    expect((await offline.call('/api/series/missing/prepare', 'POST')).status).toBe(404);
    const invalid = setup({ getCatalog: async () => ({ version: 'small', championIds: [1, 2, 3] }) });
    invalid.repository.createSeries('small');
    expect((await invalid.call('/api/series/small/prepare', 'POST')).status).toBe(503);
    expect(invalid.repository.countSeries()).toBe(1);
    const unknown = setup({ getCatalog: async () => ({ version: 'unknown', championIds: Array.from({ length: 20 }, (_, index) => index + 1) }) });
    unknown.repository.createSeries('unknown');
    unknown.repository.addGame('unknown', firstGame);
    expect(await (await unknown.call('/api/series/unknown/prepare', 'POST')).json()).toMatchObject({ error: 'unknown_champion_ids' });
    expect(unknown.repository.countSeries()).toBe(1);
  });

  it('cuenta series persistidas y permite crearlas sin token', async () => {
    const { call } = setup();
    expect(await (await call('/api/series/count')).json()).toEqual({ success: true, count: 0 });

    const created = await call('/api/series', 'POST', { seriesId: 'fearless-001' });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ success: true, seriesId: 'fearless-001' });
    expect(await (await call('/api/series/count')).json()).toEqual({ success: true, count: 1 });

    const duplicate = await call('/api/series', 'POST', { seriesId: 'fearless-001' }, true);
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ success: false, error: 'series_already_exists' });
    expect(await (await call('/api/series/count')).json()).toEqual({ success: true, count: 1 });

    await call('/api/series', 'POST', { seriesId: 'fearless-002' }, true);
    expect(await (await call('/api/series/count')).json()).toEqual({ success: true, count: 2 });
  });

  it('conserva las series y el recuento al reabrir la base de datos', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fearless-api-test-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'fearless.db');
    const first = new DatabaseSync(path);
    const repository = new SqliteSeriesRepository(first);
    repository.createSeries('one');
    repository.createSeries('two');
    first.close();

    const reopened = new DatabaseSync(path);
    databases.push(reopened);
    const persisted = new SqliteSeriesRepository(reopened);
    expect(persisted.countSeries()).toBe(2);
    expect(persisted.getSeries('one')?.seriesId).toBe('one');
    expect(persisted.listEvents('one', 20, 0).items[0].type).toBe('series_created');
  });

  it('guarda partidas, lee campeones usados y rechaza duplicados', async () => {
    const { call } = setup();
    await call('/api/series', 'POST', { seriesId: 'series-a' }, true);
    const created = await call('/api/series/series-a/games', 'POST', firstGame);
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ success: true, gameNumber: 1, winner: null });

    const series = await (await call('/api/series/series-a')).json() as { games: unknown[]; usedChampions: number[] };
    expect(series.games).toHaveLength(1);
    expect(series.usedChampions).toEqual([...firstGame.blueTeam, ...firstGame.redTeam]);
    expect(await (await call('/api/series/series-a/used-champions')).json()).toEqual({ success: true, usedChampions: series.usedChampions });

    const duplicateNumber = await call('/api/series/series-a/games', 'POST', firstGame, true);
    expect(await duplicateNumber.json()).toMatchObject({ success: false, error: 'game_number_exists' });

    const reusedChampion = await call('/api/series/series-a/games', 'POST', {
      gameNumber: 2, blueTeam: [103, 1, 2, 3, 4], redTeam: [5, 6, 8, 9, 10],
    }, true);
    expect(reusedChampion.status).toBe(409);
    expect(await reusedChampion.json()).toMatchObject({ success: false, error: 'champion_already_used' });
    expect((await (await call('/api/series/series-a')).json() as { games: unknown[] }).games).toHaveLength(1);
  });

  it('valida equipos, ID y serie inexistente', async () => {
    const { call } = setup();
    const invalidId = await call('/api/series', 'POST', { seriesId: 'count' }, true);
    expect(invalidId.status).toBe(400);
    expect(await invalidId.json()).toMatchObject({ error: 'invalid_series_id' });

    await call('/api/series', 'POST', { seriesId: 'series-a' }, true);
    const duplicateChampion = await call('/api/series/series-a/games', 'POST', {
      ...firstGame, redTeam: [103, 254, 238, 81, 111],
    }, true);
    expect(duplicateChampion.status).toBe(400);
    expect(await duplicateChampion.json()).toMatchObject({ error: 'duplicate_champion' });

    const invalidTeam = await call('/api/series/series-a/games', 'POST', { ...firstGame, blueTeam: [1, 2] }, true);
    expect(await invalidTeam.json()).toMatchObject({ error: 'invalid_teams' });

    const missing = await call('/api/series/absent/games', 'POST', firstGame, true);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: 'series_not_found' });
  });

  it('lista series con paginación y las borra con sus partidas', async () => {
    const { call, database } = setup();
    for (const seriesId of ['alpha', 'beta', 'gamma']) {
      expect((await call('/api/series', 'POST', { seriesId }, true)).status).toBe(201);
    }
    await call('/api/series/beta/games', 'POST', firstGame, true);
    const page = await (await call('/api/series?limit=1&offset=1')).json() as { series: Array<{ seriesId: string; gamesCount: number }>; total: number; limit: number; offset: number };
    expect(page).toMatchObject({ total: 3, limit: 1, offset: 1 });
    expect(page.series).toHaveLength(1);
    const all = await (await call('/api/series?limit=3')).json() as { series: Array<{ seriesId: string; gamesCount: number }> };
    expect(all.series.find((item) => item.seriesId === 'beta')?.gamesCount).toBe(1);
    expect((await call('/api/series?limit=101')).status).toBe(400);
    expect((await call('/api/series?offset=-1')).status).toBe(400);

    expect((await call('/api/series/beta', 'DELETE')).status).toBe(401);
    expect((await call('/api/series/beta', 'DELETE', undefined, true)).status).toBe(401);
    expect((await call('/api/series/beta', 'DELETE', undefined, 'admin')).status).toBe(200);
    expect(await (await call('/api/series/count')).json()).toEqual({ success: true, count: 2 });
    expect((await call('/api/series/beta')).status).toBe(404);
    expect((await call('/api/series/beta', 'DELETE', undefined, 'admin')).status).toBe(404);
    const orphanGames = database.prepare('SELECT COUNT(*) AS count FROM games WHERE series_id = ?').get('beta') as { count: number };
    expect(orphanGames.count).toBe(0);
    const orphanEvents = database.prepare('SELECT COUNT(*) AS count FROM events WHERE series_id = ?').get('beta') as { count: number };
    expect(orphanEvents.count).toBe(0);
  });

  it('consulta, corrige y borra partidas manteniendo las reglas Fearless', async () => {
    const { call } = setup();
    await call('/api/series', 'POST', { seriesId: 'playoffs' }, true);
    await call('/api/series/playoffs/games', 'POST', secondGame, true);
    await call('/api/series/playoffs/games', 'POST', firstGame, true);
    const games = await (await call('/api/series/playoffs/games')).json() as { games: Array<{ gameNumber: number }> };
    expect(games.games.map((game) => game.gameNumber)).toEqual([1, 2]);
    expect(await (await call('/api/series/playoffs/games/1')).json()).toMatchObject({ gameNumber: 1, blueTeam: firstGame.blueTeam });
    expect((await call('/api/series/playoffs/games/99')).status).toBe(404);
    expect((await call('/api/series/playoffs/games/0')).status).toBe(400);

    const gamePath = '/api/series/playoffs/games/1';
    expect((await call(gamePath, 'PATCH', { blueTeam: secondGame.blueTeam })).status).toBe(401);
    expect((await call(gamePath, 'PATCH', { blueTeam: secondGame.blueTeam }, true)).status).toBe(401);
    const conflict = await call(gamePath, 'PATCH', { blueTeam: secondGame.blueTeam }, 'admin');
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ error: 'champion_already_used' });
    expect((await call(gamePath, 'PATCH', { blueTeam: [30, 31] }, 'admin')).status).toBe(400);
    const corrected = await call(gamePath, 'PATCH', { blueTeam: [30, 31, 32, 33, 34] }, 'admin');
    expect(corrected.status).toBe(200);
    expect(await corrected.json()).toMatchObject({ blueTeam: [30, 31, 32, 33, 34], redTeam: firstGame.redTeam });
    const afterCorrection = await (await call('/api/series/playoffs/used-champions')).json() as { usedChampions: number[] };
    expect(afterCorrection.usedChampions).not.toContain(103);

    expect((await call(gamePath, 'DELETE')).status).toBe(401);
    expect((await call(gamePath, 'DELETE', undefined, true)).status).toBe(401);
    expect((await call(gamePath, 'DELETE', undefined, 'admin')).status).toBe(200);
    expect((await call(gamePath)).status).toBe(404);
    const afterDelete = await (await call('/api/series/playoffs/used-champions')).json() as { usedChampions: number[] };
    expect(afterDelete.usedChampions).not.toContain(266);
    expect(afterDelete.usedChampions).toContain(20);
    expect((await call('/api/series/playoffs/games', 'POST', { ...firstGame, gameNumber: 3 }, true)).status).toBe(201);
    const events = await (await call('/api/series/playoffs/events')).json() as { events: Array<{ type: string }> };
    expect(events.events.map((event) => event.type)).toEqual([
      'series_created', 'game_created', 'game_created', 'game_updated', 'game_deleted', 'game_created',
    ]);
  });

  it('asigna ganador y guarda un historial cronológico sin alterar campeones', async () => {
    const { call } = setup();
    await call('/api/series', 'POST', { seriesId: 'final' }, true);
    await call('/api/series/final/games', 'POST', firstGame, true);
    const usedBefore = await (await call('/api/series/final/used-champions')).json();
    const winnerPath = '/api/series/final/games/1/winner';
    expect((await call(winnerPath, 'PUT', { winner: 'blue' })).status).toBe(401);
    expect((await call(winnerPath, 'PUT', { winner: 'blue' }, true)).status).toBe(401);
    expect((await call(winnerPath, 'PUT', { winner: 'green' }, 'admin')).status).toBe(400);
    expect(await (await call(winnerPath, 'PUT', { winner: 'blue' }, 'admin')).json()).toMatchObject({ winner: 'blue' });
    expect(await (await call(winnerPath, 'PUT', { winner: null }, 'admin')).json()).toMatchObject({ winner: null });
    expect(await (await call('/api/series/final/used-champions')).json()).toEqual(usedBefore);

    const events = await (await call('/api/series/final/events')).json() as { events: Array<{ type: string }>; total: number };
    expect(events.events.map((event) => event.type)).toEqual(['series_created', 'game_created', 'winner_changed', 'winner_changed']);
    expect(events.total).toBe(4);
    const page = await (await call('/api/series/final/events?limit=2&offset=1')).json() as { events: Array<{ type: string }>; total: number };
    expect(page.events.map((event) => event.type)).toEqual(['game_created', 'winner_changed']);
    expect(page.total).toBe(4);
  });

  it('devuelve disponibilidad solo con un catálogo completo y versionado', async () => {
    const { call } = setup();
    await call('/api/series', 'POST', { seriesId: 'available' }, true);
    await call('/api/series/available/games', 'POST', firstGame, true);
    const response = await call('/api/series/available/availability');
    expect(response.status).toBe(200);
    const data = await response.json() as { catalogVersion: string; totalChampions: number; usedChampions: number[]; availableChampions: number[] };
    expect(data.catalogVersion).toBe('test-1');
    expect(data.totalChampions).toBe(500);
    expect(data.usedChampions).toHaveLength(10);
    expect(data.availableChampions).toHaveLength(490);
    expect(data.availableChampions).not.toContain(103);

    const unavailable = setup({ getCatalog: async () => { throw new Error('offline'); } });
    await unavailable.call('/api/series', 'POST', { seriesId: 'offline' }, true);
    expect(await (await unavailable.call('/api/series/offline/availability')).json()).toMatchObject({ success: false, error: 'catalog_unavailable' });

    const incomplete = setup({ getCatalog: async () => ({ version: 'test-2', championIds: [1, 2, 3] }) });
    await incomplete.call('/api/series', 'POST', { seriesId: 'incomplete' }, true);
    await incomplete.call('/api/series/incomplete/games', 'POST', firstGame, true);
    expect((await incomplete.call('/api/series/incomplete/availability')).status).toBe(409);
  });

  it('borra todas las partidas como Sites, conserva la serie y libera los campeones', async () => {
    const { call, repository } = setup();
    await call('/api/series', 'POST', { seriesId: 'reset' }, true);
    await call('/api/series', 'POST', { seriesId: 'other' }, true);
    await call('/api/series/reset/games', 'POST', firstGame, true);
    await call('/api/series/reset/games', 'POST', secondGame, true);
    await call('/api/series/other/games', 'POST', firstGame, true);
    const path = '/api/series/reset/games';
    const unauthorized = await call(path, 'DELETE');
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toMatchObject({ success: false, error: 'UNAUTHORIZED' });
    expect(repository.listGames('reset')).toHaveLength(2);
    expect((await call(path, 'DELETE', undefined, true)).status).toBe(401);
    const deleted = await call(path, 'DELETE', undefined, 'admin');
    expect(await deleted.json()).toMatchObject({ success: true, seriesId: 'reset', deletedGames: 2, updatedAt: expect.any(String) });
    expect(repository.countSeries()).toBe(2);
    expect(repository.getSeries('reset')).toMatchObject({ games: [], usedChampions: [] });
    expect(repository.listGames('other')).toHaveLength(1);
    expect(repository.listEvents('reset', 20, 0).items.at(-1)).toMatchObject({ type: 'games_cleared', details: { deletedGames: 2 } });
    expect(await (await call(path, 'DELETE', undefined, 'admin')).json()).toMatchObject({ deletedGames: 0 });
    expect((await call('/api/series/reset/games', 'POST', firstGame, true)).status).toBe(201);

    const unconfigured = createApiHandler(repository, { adminToken: '' });
    const missingConfig = await unconfigured(new Request('http://localhost' + path, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }));
    expect(missingConfig.status).toBe(503);
    expect(await missingConfig.json()).toMatchObject({ error: 'ADMIN_TOKEN_NOT_CONFIGURED' });

    const separateAdmin = createApiHandler(repository, { adminToken: 'admin-key' });
    expect((await separateAdmin(new Request('http://localhost' + path, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }))).status).toBe(401);
    expect((await separateAdmin(new Request('http://localhost' + path, { method: 'DELETE', headers: { Authorization: 'bearer admin-key' } }))).status).toBe(200);
  });

  it('valida el token de administrador sin aceptar otro token', async () => {
    const { call } = setup();
    const path = '/api/admin/validate';
    expect((await call(path)).status).toBe(401);
    expect((await call(path, 'GET', undefined, true)).status).toBe(401);
    expect(await (await call(path, 'GET', undefined, 'admin')).json()).toEqual({ valid: true });
  });

  it('sirve health y preflight CORS', async () => {
    const { repository } = setup();
    const handler = createApiHandler(repository, {});
    const health = await handler(new Request('http://localhost/api/health', {
      headers: { Origin: 'https://tauri-app.example' },
    }));
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ database: 'online' });
    expect(health.headers.get('Access-Control-Allow-Origin')).toBe('*');

    const options = await handler(new Request('http://localhost/api/health', {
      method: 'OPTIONS', headers: {
        Origin: 'tauri://localhost',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    }));
    expect(options.status).toBe(204);
    expect(options.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(options.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(options.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('mantiene la lista de orígenes permitidos cuando se configura explícitamente', async () => {
    const { repository } = setup();
    const restricted = createApiHandler(repository, {
      allowedOrigin: 'https://app.example',
    });
    const denied = await restricted(new Request('http://localhost/api/health', {
      headers: { Origin: 'https://other.example' },
    }));
    const allowed = await restricted(new Request('http://localhost/api/health', {
      headers: { Origin: 'https://app.example' },
    }));
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
  });

  it('responde 503 cuando la base de datos deja de estar disponible', async () => {
    const { database, call } = setup();
    database.close();
    databases.splice(databases.indexOf(database), 1);
    for (const path of ['/api/health', '/api/series/count']) {
      const response = await call(path);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ success: false, error: 'database_unavailable' });
    }
  });

  it('funciona a través del servidor HTTP local', async () => {
    const { repository } = setup();
    const server = createLocalServer(repository, adminToken, undefined, { getCatalog: async () => ({ version: 'test-1', championIds: Array.from({ length: 500 }, (_, index) => index + 1) }) });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Puerto HTTP no disponible');
      const base = `http://127.0.0.1:${address.port}`;
      const created = await fetch(`${base}/api/series`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId: 'http-series' }),
      });
      expect(created.status).toBe(201);
      const count = await fetch(`${base}/api/series/count`);
      expect(await count.json()).toEqual({ success: true, count: 1 });
      const createGame = await fetch(`${base}/api/series/http-series/games`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firstGame),
      });
      expect(createGame.status).toBe(201);
      const corrected = await fetch(`${base}/api/series/http-series/games/1`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueTeam: [30, 31, 32, 33, 34] }),
      });
      expect(await corrected.json()).toMatchObject({ blueTeam: [30, 31, 32, 33, 34] });
      const winner = await fetch(`${base}/api/series/http-series/games/1/winner`, {
        method: 'PUT', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner: 'red' }),
      });
      expect(await winner.json()).toMatchObject({ winner: 'red' });
      const availability = await fetch(`${base}/api/series/http-series/availability`);
      expect(await availability.json()).toMatchObject({ catalogVersion: 'test-1', totalChampions: 500 });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
