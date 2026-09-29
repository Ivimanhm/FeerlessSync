import type { ApiErrorBody, CreateGameRequest, CreateSeriesRequest, SetWinnerRequest } from '../../types/api';

export class FearlessApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'FearlessApiError';
  }
}

export interface FearlessApiClientOptions {
  /** API origin, for example https://api.example.com. The /api prefix is added here. */
  baseUrl: string;
  /** Required for administrative operations; credentials are not stored by this client. */
  getAccessToken?: () => string | null;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null &&
    'success' in value && value.success === false &&
    'error' in value && typeof value.error === 'string';
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item) && item > 0);
}

/** Client for the Fearless Sync API. */
export function createFearlessApiClient({ baseUrl, getAccessToken }: FearlessApiClientOptions) {
  const origin = baseUrl.trim().replace(/\/+$/, '');
  if (!origin) throw new Error('Falta la URL base de la API.');

  const request = async (path: string, options: RequestInit = {}, authenticated = false): Promise<unknown> => {
    const token = authenticated ? getAccessToken?.() : null;
    if (authenticated && !token) throw new FearlessApiError(0, 'authentication_required', 'Esta operación requiere autenticación.');

    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (options.body) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${origin}/api${path}`, {
      ...options,
      headers,
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const code = isApiErrorBody(body) ? body.error : `http_${response.status}`;
      const message = isApiErrorBody(body) && body.message ? body.message : `La API respondió con HTTP ${response.status}.`;
      throw new FearlessApiError(response.status, code, message);
    }
    return body;
  };

  return {
    async health(): Promise<boolean> {
      try {
        await request('/health');
        return true;
      } catch (error) {
        if (error instanceof FearlessApiError && error.status === 503) return false;
        throw error;
      }
    },

    getSeries(seriesId: string): Promise<unknown> {
      return request(`/series/${encodeURIComponent(seriesId)}`);
    },

    listSeries(limit = 20, offset = 0): Promise<unknown> {
      return request(`/series?limit=${limit}&offset=${offset}`);
    },

    /** Counts persisted series without returning their IDs. */
    async getSeriesCount(): Promise<number> {
      const body = await request('/series/count');
      if (typeof body === 'object' && body !== null && 'count' in body &&
        typeof body.count === 'number' && Number.isSafeInteger(body.count) && body.count >= 0) {
        return body.count;
      }
      throw new FearlessApiError(200, 'invalid_response', 'La API devolvió un recuento de series no válido.');
    },

    async getUsedChampionIds(seriesId: string): Promise<number[]> {
      const body = await request(`/series/${encodeURIComponent(seriesId)}/used-champions`);
      if (isNumberArray(body)) return body;
      if (typeof body === 'object' && body !== null) {
        if ('usedChampions' in body && isNumberArray(body.usedChampions)) return body.usedChampions;
        if ('championIds' in body && isNumberArray(body.championIds)) return body.championIds;
      }
      throw new FearlessApiError(200, 'invalid_response', 'La API devolvió una lista de campeones no válida.');
    },

    createSeries(input: CreateSeriesRequest): Promise<unknown> {
      return request('/series', { method: 'POST', body: JSON.stringify(input) });
    },

    deleteSeries(seriesId: string): Promise<unknown> {
      return request(`/series/${encodeURIComponent(seriesId)}`, { method: 'DELETE' }, true);
    },

    createGame(seriesId: string, input: CreateGameRequest): Promise<unknown> {
      return request(`/series/${encodeURIComponent(seriesId)}/games`, { method: 'POST', body: JSON.stringify(input) });
    },

    getGames(seriesId: string): Promise<unknown> {
      return request(`/series/${encodeURIComponent(seriesId)}/games`);
    },

    getGame(seriesId: string, gameNumber: number): Promise<unknown> {
      return request(`/series/${encodeURIComponent(seriesId)}/games/${gameNumber}`);
    },

    updateGame(seriesId: string, gameNumber: number, input: Partial<Pick<CreateGameRequest, 'blueTeam' | 'redTeam'>>): Promise<unknown> {
      return request(`/series/${encodeURIComponent(seriesId)}/games/${gameNumber}`, { method: 'PATCH', body: JSON.stringify(input) });
    },

    deleteGame(seriesId: string, gameNumber: number): Promise<unknown> {
      return request(`/series/${encodeURIComponent(seriesId)}/games/${gameNumber}`, { method: 'DELETE' }, true);
    },

    clearGames(seriesId: string): Promise<unknown> {
      return request(`/series/${encodeURIComponent(seriesId)}/games`, { method: 'DELETE' }, true);
    },

    setWinner(seriesId: string, gameNumber: number, input: SetWinnerRequest): Promise<unknown> {
      return request(`/series/${encodeURIComponent(seriesId)}/games/${gameNumber}/winner`, { method: 'PUT', body: JSON.stringify(input) }, true);
    },

    getAvailability(seriesId: string): Promise<unknown> {
      return request(`/series/${encodeURIComponent(seriesId)}/availability`);
    },

    getEvents(seriesId: string, limit = 20, offset = 0): Promise<unknown> {
      return request(`/series/${encodeURIComponent(seriesId)}/events?limit=${limit}&offset=${offset}`);
    },
  };
}
