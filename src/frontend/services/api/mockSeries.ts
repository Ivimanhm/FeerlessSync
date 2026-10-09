import { FearlessApiError } from './client';
import type { StoredSeries } from './series';
import type { TeamSide } from '../../types/fearless';
import { countChampionWins } from '../../../shared/championWins';

const storageKey = 'fearless-sync-local-preview-v1';

function initialSeries(): StoredSeries {
  const games = [
    { gameNumber: 1, blueTeam: [266, 32, 103, 523, 12], redTeam: [122, 131, 84, 22, 201], winner: 'blue' as const, createdAt: '2026-09-23T18:00:00.000Z' },
    { gameNumber: 2, blueTeam: [164, 245, 34, 51, 53], redTeam: [86, 60, 1, 119, 432], winner: 'red' as const, createdAt: '2026-09-24T18:00:00.000Z' },
    { gameNumber: 3, blueTeam: [24, 64, 238, 222, 412], redTeam: [39, 7, 99, 81, 111], winner: null, createdAt: '2026-09-25T18:00:00.000Z' },
  ];
  return { seriesId: 'fearless-001', updatedAt: games[2].createdAt, games, usedChampions: games.flatMap((game) => [...game.blueTeam, ...game.redTeam]) };
}

function readSeries(): StoredSeries | null {
  const saved = window.localStorage.getItem(storageKey);
  if (saved === null) return initialSeries();
  try {
    const value: unknown = JSON.parse(saved);
    return value && typeof value === 'object' && 'seriesId' in value ? value as StoredSeries : null;
  } catch { return initialSeries(); }
}

function saveSeries(series: StoredSeries | null): void {
  window.localStorage.setItem(storageKey, JSON.stringify(series));
}

export function resetMockSeries(): void {
  window.localStorage.removeItem(storageKey);
}

export function getMockChampionWinStats() {
  return countChampionWins(readSeries()?.games ?? []);
}

export function getMockSeries(seriesId: string): StoredSeries {
  const series = readSeries();
  if (!series || series.seriesId !== seriesId) throw new FearlessApiError(404, 'series_not_found', 'La serie no existe.');
  return series;
}

export function clearMockGames(seriesId: string): number {
  const series = getMockSeries(seriesId);
  const count = series.games.length;
  saveSeries({ ...series, games: [], usedChampions: [], updatedAt: new Date().toISOString() });
  return count;
}

export function setMockWinner(seriesId: string, gameNumber: number, winner: TeamSide | null): void {
  const series = getMockSeries(seriesId);
  const game = series.games.find((item) => item.gameNumber === gameNumber);
  if (!game) throw new FearlessApiError(404, 'game_not_found', 'La partida no existe.');
  saveSeries({ ...series, games: series.games.map((item) => item.gameNumber === gameNumber ? { ...item, winner } : item), updatedAt: new Date().toISOString() });
}

export function deleteMockSeries(seriesId: string): void {
  getMockSeries(seriesId);
  saveSeries(null);
}
