import type { Champion, FearlessSeries, Game, PlayedChampion, Role, TeamSide } from '../../types/fearless';
import { getChampionCatalog } from '../championCatalog';
import { createFearlessApiClient } from './client';

interface StoredGame {
  gameNumber: number;
  blueTeam: number[];
  redTeam: number[];
  winner?: TeamSide | null;
  createdAt: string;
}

const roleOrder: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

interface StoredSeries {
  seriesId: string;
  updatedAt?: string | null;
  games: StoredGame[];
  usedChampions: number[];
}

function isStoredSeries(value: unknown): value is StoredSeries {
  if (!value || typeof value !== 'object') return false;
  const series = value as Partial<StoredSeries>;
  return typeof series.seriesId === 'string' && Array.isArray(series.usedChampions) &&
    series.usedChampions.every((id) => Number.isSafeInteger(id) && id > 0) &&
    Array.isArray(series.games) && series.games.every((game) =>
      Number.isSafeInteger(game?.gameNumber) && game.gameNumber > 0 &&
      typeof game.createdAt === 'string' && !Number.isNaN(Date.parse(game.createdAt)) &&
      Array.isArray(game.blueTeam) && game.blueTeam.length === 5 && game.blueTeam.every((id) => Number.isSafeInteger(id) && id > 0) &&
      Array.isArray(game.redTeam) && game.redTeam.length === 5 && game.redTeam.every((id) => Number.isSafeInteger(id) && id > 0) &&
      (game.winner === undefined || game.winner === null || game.winner === 'blue' || game.winner === 'red'));
}

export function mapStoredSeries(stored: StoredSeries, catalog: Champion[]): FearlessSeries {
  const championsById = new Map(catalog.map((champion) => [champion.id, champion]));
  const used = new Set(stored.usedChampions);
  const availableChampions = catalog.filter((champion) => !used.has(champion.id));
  const games: Game[] = stored.games.map((game) => {
    const played = (id: number, team: TeamSide, role: Role): PlayedChampion => {
      const champion = championsById.get(id);
      return {
        championId: id,
        championName: champion?.name ?? `Campeón ${id}`,
        imageUrl: champion?.imageUrl,
        team,
        role,
      };
    };
    return {
      gameNumber: game.gameNumber,
      date: game.createdAt,
      winner: game.winner ?? null,
      champions: [
        ...game.blueTeam.map((id, index) => played(id, 'blue', roleOrder[index])),
        ...game.redTeam.map((id, index) => played(id, 'red', roleOrder[index])),
      ],
    };
  });
  return {
    seriesId: stored.seriesId,
    updatedAt: stored.updatedAt ?? null,
    usedChampions: [...used],
    gamesCount: games.length,
    usedChampionsCount: used.size,
    availableChampionsCount: availableChampions.length,
    totalChampionsCount: catalog.length,
    availableChampions,
    games,
  };
}

/** Reads confirmed series from the API. */
export async function getFearlessSeries(seriesId: string): Promise<FearlessSeries> {
  const normalizedId = seriesId.trim();

  if (!normalizedId) {
    throw new Error('El identificador de serie está vacío.');
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || window.location.origin;
  const client = createFearlessApiClient({ baseUrl });
  const [response, catalog] = await Promise.all([client.getSeries(normalizedId), getChampionCatalog()]);
  if (!isStoredSeries(response)) throw new Error('La API devolvió una serie no válida.');
  return mapStoredSeries(response, catalog);
}

export async function clearSeriesGames(seriesId: string, token: string): Promise<number> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || window.location.origin;
  const client = createFearlessApiClient({ baseUrl, getAccessToken: () => token });
  const result = await client.clearGames(seriesId);
  if (!result || typeof result !== 'object' || !('deletedGames' in result) ||
      typeof result.deletedGames !== 'number' || !Number.isSafeInteger(result.deletedGames) || result.deletedGames < 0) {
    throw new Error('No se pudieron borrar las partidas. Inténtalo de nuevo.');
  }
  return result.deletedGames;
}

/** Saves a game's winner with an admin key kept only for this request. */
export async function setGameWinner(seriesId: string, gameNumber: number, winner: TeamSide | null, token: string): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || window.location.origin;
  const client = createFearlessApiClient({ baseUrl, getAccessToken: () => token });
  const result = await client.setWinner(seriesId, gameNumber, { winner });
  if (!result || typeof result !== 'object' || !('success' in result) || result.success !== true ||
      !('seriesId' in result) || result.seriesId !== seriesId ||
      !('gameNumber' in result) || result.gameNumber !== gameNumber ||
      !('winner' in result) || result.winner !== winner) {
    throw new Error('No se pudo guardar el ganador. Inténtalo de nuevo.');
  }
}

/** Permanently removes a series using an admin token held only by the caller. */
export async function deleteFearlessSeries(seriesId: string, token: string): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || window.location.origin;
  const client = createFearlessApiClient({ baseUrl, getAccessToken: () => token });
  const result = await client.deleteSeries(seriesId);
  if (!result || typeof result !== 'object' || !('deleted' in result) || result.deleted !== true ||
      !('seriesId' in result) || result.seriesId !== seriesId) {
    throw new Error('No se pudo eliminar la serie. Inténtalo de nuevo.');
  }
}
