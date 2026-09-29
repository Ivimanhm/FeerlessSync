import { requireAdmin } from '../services/authentication.ts';
import { validateGame, seriesIdFrom, gameNumberFrom } from '../services/seriesValidation.ts';
import { DataDragonCatalogProvider } from '../services/championCatalog.ts';
import { ApiFault } from '../errors.ts';
import type { ChampionCatalogProvider, SeriesRepository } from '../types.ts';

interface ApiOptions {
  adminToken?: string;
  allowedOrigin?: string | string[];
  catalogProvider?: ChampionCatalogProvider;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function databaseCall<T>(action: () => T | Promise<T>): Promise<T> {
  try { return await action(); }
  catch (error) {
    if (error instanceof ApiFault) throw error;
    throw new ApiFault(503, 'database_unavailable', 'La base de datos no está disponible.');
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

async function bodyObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try { value = await request.json(); }
  catch { throw new ApiFault(400, 'invalid_json', 'El cuerpo debe ser JSON válido.'); }
  const object = record(value);
  if (!object) throw new ApiFault(400, 'invalid_body', 'El cuerpo debe ser un objeto JSON.');
  return object;
}

function pagination(url: URL): { limit: number; offset: number } {
  const limitText = url.searchParams.get('limit') ?? '20';
  const offsetText = url.searchParams.get('offset') ?? '0';
  if (!/^[1-9]\d*$/.test(limitText) || !/^\d+$/.test(offsetText)) {
    throw new ApiFault(400, 'invalid_pagination', 'limit y offset deben ser enteros válidos.');
  }
  const limit = Number(limitText);
  const offset = Number(offsetText);
  if (!Number.isSafeInteger(limit) || limit > 100 || !Number.isSafeInteger(offset)) {
    throw new ApiFault(400, 'invalid_pagination', 'limit debe estar entre 1 y 100; offset debe ser no negativo.');
  }
  return { limit, offset };
}

export function createApiHandler(repository: SeriesRepository, options: ApiOptions) {
  const catalogProvider = options.catalogProvider ?? new DataDragonCatalogProvider();

  const dispatch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname;
    const parts = path.split('/').filter(Boolean);
    const method = request.method.toUpperCase();
    if (parts[0] !== 'api') throw new ApiFault(404, 'not_found', 'Ruta no encontrada.');

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      } });
    }

    if (path === '/api/health' && method === 'GET') {
      await databaseCall(() => repository.checkHealth());
      return json({ status: 'ok', api: 'online', database: 'online' });
    }
    if (path === '/api/admin/validate' && method === 'GET') {
      requireAdmin(request, options.adminToken ?? '');
      return json({ valid: true });
    }
    if (path === '/api/series/count' && method === 'GET') {
      return json({ success: true, count: await databaseCall(() => repository.countSeries()) });
    }
    if (path === '/api/series' && method === 'GET') {
      const { limit, offset } = pagination(url);
      const page = await databaseCall(() => repository.listSeries(limit, offset));
      return json({ success: true, series: page.items, total: page.total, limit, offset });
    }
    if (path === '/api/series' && method === 'POST') {
      const body = await bodyObject(request);
      if (typeof body.seriesId !== 'string') throw new ApiFault(400, 'invalid_series_id', 'Falta seriesId.');
      const seriesId = seriesIdFrom(body.seriesId);
      return json({ success: true, ...await databaseCall(() => repository.createSeries(seriesId)) }, 201);
    }

    if (parts.length >= 3 && parts[1] === 'series') {
      const seriesId = seriesIdFrom(parts[2]);
      if (parts.length === 3 && method === 'GET') {
        const series = await databaseCall(() => repository.getSeries(seriesId));
        if (!series) throw new ApiFault(404, 'series_not_found', 'La serie no existe.');
        return json({ success: true, ...series });
      }
      if (parts.length === 3 && method === 'DELETE') {
        requireAdmin(request, options.adminToken ?? '');
        const deleted = await databaseCall(() => repository.deleteSeries(seriesId));
        if (!deleted) throw new ApiFault(404, 'series_not_found', 'La serie no existe.');
        return json({ success: true, seriesId, deleted: true });
      }
      if (parts.length === 4 && parts[3] === 'used-champions' && method === 'GET') {
        const usedChampions = await databaseCall(() => repository.getUsedChampions(seriesId));
        if (!usedChampions) throw new ApiFault(404, 'series_not_found', 'La serie no existe.');
        return json({ success: true, usedChampions });
      }
      if (parts.length === 4 && parts[3] === 'availability' && method === 'GET') {
        const usedChampions = await databaseCall(() => repository.getUsedChampions(seriesId));
        if (!usedChampions) throw new ApiFault(404, 'series_not_found', 'La serie no existe.');
        let catalog;
        try { catalog = await catalogProvider.getCatalog(); }
        catch { throw new ApiFault(503, 'catalog_unavailable', 'No se pudo consultar el catálogo completo.'); }
        const ids = new Set(catalog.championIds);
        if (usedChampions.some((id) => !ids.has(id))) {
          throw new ApiFault(409, 'unknown_champion_ids', 'Hay campeones usados que no aparecen en el catálogo.');
        }
        const used = new Set(usedChampions);
        return json({
          success: true, seriesId, catalogVersion: catalog.version,
          totalChampions: catalog.championIds.length,
          usedChampions,
          availableChampions: catalog.championIds.filter((id) => !used.has(id)),
        });
      }
      if (parts.length === 4 && parts[3] === 'events' && method === 'GET') {
        const { limit, offset } = pagination(url);
        const page = await databaseCall(() => repository.listEvents(seriesId, limit, offset));
        return json({ success: true, seriesId, events: page.items, total: page.total, limit, offset });
      }
      if (parts.length === 4 && parts[3] === 'games') {
        if (method === 'DELETE') {
          requireAdmin(request, options.adminToken ?? '');
          const result = await databaseCall(() => repository.clearGames(seriesId));
          return json({ success: true, seriesId, ...result });
        }
        if (method === 'GET') {
          const games = await databaseCall(() => repository.listGames(seriesId));
          return json({ success: true, seriesId, games });
        }
        if (method === 'POST') {
          const game = validateGame(await bodyObject(request));
          return json({ success: true, seriesId, ...await databaseCall(() => repository.addGame(seriesId, game)) }, 201);
        }
      }
      if (parts.length >= 5 && parts[3] === 'games') {
        const gameNumber = gameNumberFrom(parts[4]);
        if (parts.length === 5 && method === 'GET') {
          return json({ success: true, seriesId, ...await databaseCall(() => repository.getGame(seriesId, gameNumber)) });
        }
        if (parts.length === 5 && method === 'PATCH') {
          const body = await bodyObject(request);
          if ((!('blueTeam' in body) && !('redTeam' in body)) || 'gameNumber' in body || 'winner' in body) {
            throw new ApiFault(400, 'invalid_body', 'Indica blueTeam o redTeam para corregir la partida.');
          }
          const previous = await databaseCall(() => repository.getGame(seriesId, gameNumber));
          const game = validateGame({
            gameNumber,
            blueTeam: 'blueTeam' in body ? body.blueTeam : previous.blueTeam,
            redTeam: 'redTeam' in body ? body.redTeam : previous.redTeam,
          });
          return json({ success: true, seriesId, ...await databaseCall(() => repository.updateGame(seriesId, game)) });
        }
        if (parts.length === 5 && method === 'DELETE') {
          requireAdmin(request, options.adminToken ?? '');
          await databaseCall(() => repository.deleteGame(seriesId, gameNumber));
          return json({ success: true, seriesId, gameNumber, deleted: true });
        }
        if (parts.length === 6 && parts[5] === 'winner' && method === 'PUT') {
          requireAdmin(request, options.adminToken ?? '');
          const body = await bodyObject(request);
          if (!('winner' in body) || (body.winner !== 'blue' && body.winner !== 'red' && body.winner !== null)) {
            throw new ApiFault(400, 'invalid_winner', 'winner debe ser blue, red o null.');
          }
          return json({ success: true, seriesId, ...await databaseCall(() => repository.setWinner(seriesId, gameNumber, body.winner as 'blue' | 'red' | null)) });
        }
      }
    }
    throw new ApiFault(404, 'not_found', 'Ruta no encontrada.');
  };

  return async (request: Request): Promise<Response> => {
    let response: Response;
    try { response = await dispatch(request); }
    catch (error) {
      response = error instanceof ApiFault
        ? json({ success: false, error: error.code, message: error.message }, error.status)
        : json({ success: false, error: 'internal_error' }, 500);
    }
    const origin = request.headers.get('Origin');
    const allowedOrigins = options.allowedOrigin === undefined
      ? ['*']
      : Array.isArray(options.allowedOrigin) ? options.allowedOrigin : [options.allowedOrigin];
    if (origin && allowedOrigins.includes('*')) {
      response.headers.set('Access-Control-Allow-Origin', '*');
    } else if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Vary', 'Origin');
    }
    return response;
  };
}
