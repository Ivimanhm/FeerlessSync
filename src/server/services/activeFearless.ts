import { ApiFault } from '../errors.ts';
import type { ChampionCatalog, SeriesRepository, StoredSeries } from '../types.ts';
import { availableChampionIds, minimumChampionsPerGame } from './seriesContinuation.ts';

export function fearlessAvailability(series: StoredSeries, catalog: ChampionCatalog) {
  const availableChampions = availableChampionIds(catalog, series.usedChampions);
  return {
    ...series,
    catalogVersion: catalog.version,
    totalChampions: catalog.championIds.length,
    availableChampions,
    availableChampionsCount: availableChampions.length,
    minimumChampionsPerGame,
    canStartGame: availableChampions.length >= minimumChampionsPerGame,
    nextGameNumber: Math.max(0, ...series.games.map((game) => game.gameNumber)) + 1,
  };
}

export async function getActiveFearless(repository: SeriesRepository, catalog: ChampionCatalog) {
  if (new Set(catalog.championIds).size < minimumChampionsPerGame) {
    throw new ApiFault(503, 'catalog_unavailable', 'El catálogo no permite formar una partida de diez campeones.');
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    const active = fearlessAvailability(await repository.getOrCreateFearlessSeries(), catalog);
    if (active.canStartGame) return active;
    await repository.archiveFearlessSeries(active.seriesId);
  }
  throw new ApiFault(409, 'fearless_busy', 'La serie activa está cambiando. Vuelve a consultar Fearless.');
}
