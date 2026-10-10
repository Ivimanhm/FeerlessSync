import type { ChampionWinStats } from '../../../shared/championWins';
import type { Champion } from '../../types/fearless';
import { getChampionCatalog } from '../championCatalog';
import { createFearlessApiClient } from './client';
import { mockMode } from './mode';
import { getMockChampionWinStats } from './mockSeries';

export interface ChampionLeaderboard extends Omit<ChampionWinStats, 'champions'> {
  champions: (Champion & { wins: number; gamesPlayed: number })[];
}

function isStats(value: unknown): value is ChampionWinStats {
  if (!value || typeof value !== 'object') return false;
  const stats = value as Partial<ChampionWinStats>;
  const nonnegative = (count: unknown): count is number => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
  return nonnegative(stats.completedGames) && nonnegative(stats.pendingGames) && Array.isArray(stats.champions) &&
    stats.champions.every(champion => champion && nonnegative(champion.championId) && champion.championId > 0 &&
      nonnegative(champion.wins) && nonnegative(champion.gamesPlayed) &&
      champion.wins <= champion.gamesPlayed && champion.gamesPlayed <= stats.completedGames!) &&
    new Set(stats.champions.map(champion => champion.championId)).size === stats.champions.length;
}

export async function getChampionWinStats(): Promise<ChampionLeaderboard> {
  const client = createFearlessApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || window.location.origin });
  const [response, catalog] = await Promise.all([
    mockMode ? Promise.resolve(getMockChampionWinStats()) : client.getChampionWinStats(), getChampionCatalog(),
  ]);
  if (!isStats(response)) throw new Error('La API devolvió estadísticas de victorias no válidas.');
  const byId = new Map(catalog.map(champion => [champion.id, champion]));
  const counts = new Map(response.champions.map(entry => [entry.championId, entry]));
  const champions = [
    ...catalog.map(champion => ({ ...champion, wins: counts.get(champion.id)?.wins ?? 0, gamesPlayed: counts.get(champion.id)?.gamesPlayed ?? 0 })),
    ...response.champions.filter(entry => !byId.has(entry.championId)).map(entry => ({
      id: entry.championId, name: `Campeón ${entry.championId}`, roles: [],
      wins: entry.wins, gamesPlayed: entry.gamesPlayed,
    })),
  ].sort((a, b) => b.wins - a.wins || (b.gamesPlayed ? b.wins / b.gamesPlayed : 0) - (a.gamesPlayed ? a.wins / a.gamesPlayed : 0) || a.name.localeCompare(b.name, 'es') || a.id - b.id);
  return { champions, completedGames: response.completedGames, pendingGames: response.pendingGames };
}
