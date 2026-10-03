import { ApiFault } from '../errors.ts';
import type { ChampionCatalog, SeriesRepository } from '../types.ts';

export const minimumChampionsPerGame = 10;

export function availableChampionIds(catalog: ChampionCatalog, usedChampions: number[]): number[] {
  const ids = new Set(catalog.championIds);
  if (usedChampions.some((id) => !ids.has(id))) {
    throw new ApiFault(409, 'unknown_champion_ids', 'Hay campeones usados que no aparecen en el catálogo.');
  }
  const used = new Set(usedChampions);
  return catalog.championIds.filter((id) => !used.has(id));
}

async function successorId(seriesId: string): Promise<string> {
  // A stable ID lets retries and concurrent callers reuse the same successor.
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`fearless-next-series:${seriesId}`));
  return `auto-${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function prepareSeries(repository: SeriesRepository, requestedSeriesId: string, catalog: ChampionCatalog) {
  if (new Set(catalog.championIds).size < minimumChampionsPerGame) {
    throw new ApiFault(503, 'catalog_unavailable', 'El catálogo no permite formar una partida de diez campeones.');
  }
  let seriesId = requestedSeriesId;
  for (let attempt = 0; attempt < 100; attempt++) {
    const series = await repository.getSeries(seriesId);
    if (!series) throw new ApiFault(404, 'series_not_found', 'La serie no existe.');
    const availableChampions = availableChampionIds(catalog, series.usedChampions);
    if (availableChampions.length >= minimumChampionsPerGame) {
      return {
        seriesId,
        previousSeriesId: requestedSeriesId,
        seriesChanged: seriesId !== requestedSeriesId,
        catalogVersion: catalog.version,
        totalChampions: catalog.championIds.length,
        usedChampions: series.usedChampions,
        availableChampions,
        availableChampionsCount: availableChampions.length,
        minimumChampionsPerGame,
        canStartGame: true,
        nextGameNumber: Math.max(0, ...series.games.map((game) => game.gameNumber)) + 1,
      };
    }
    seriesId = await successorId(seriesId);
    if (!await repository.getSeries(seriesId)) {
      try { await repository.createSeries(seriesId); }
      catch (error) {
        // D1 may report a raw unique-constraint error if another request wins.
        if (!await repository.getSeries(seriesId)) throw error;
      }
    }
  }
  throw new ApiFault(409, 'series_chain_too_long', 'Consulta la última serie conocida para preparar la siguiente partida.');
}
