export interface StoredGame {
  gameNumber: number;
  blueTeam: number[];
  redTeam: number[];
  winner: 'blue' | 'red' | null;
  createdAt: string;
}

export interface StoredSeries {
  seriesId: string;
  createdAt: string;
  updatedAt: string;
  games: StoredGame[];
  usedChampions: number[];
}

export interface NewGame {
  gameNumber: number;
  blueTeam: number[];
  redTeam: number[];
}

export interface SeriesSummary {
  seriesId: string;
  gamesCount: number;
  updatedAt: string;
}

export interface SeriesEvent {
  id: number;
  type: 'series_created' | 'game_created' | 'game_updated' | 'game_deleted' | 'games_cleared' | 'winner_changed';
  gameNumber: number | null;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ChampionCatalog {
  version: string;
  championIds: number[];
}

export interface ChampionCatalogProvider {
  getCatalog(): Promise<ChampionCatalog>;
}

export type RepositoryResult<T> = T | Promise<T>;

export interface SeriesRepository {
  checkHealth(): RepositoryResult<void>;
  countSeries(): RepositoryResult<number>;
  listSeries(limit: number, offset: number): RepositoryResult<Page<SeriesSummary>>;
  createSeries(seriesId: string): RepositoryResult<StoredSeries>;
  getOrCreateFearlessSeries(): RepositoryResult<StoredSeries>;
  archiveFearlessSeries(seriesId: string): RepositoryResult<void>;
  getSeries(seriesId: string): RepositoryResult<StoredSeries | null>;
  deleteSeries(seriesId: string): RepositoryResult<boolean>;
  getUsedChampions(seriesId: string): RepositoryResult<number[] | null>;
  addGame(seriesId: string, game: NewGame): RepositoryResult<StoredGame>;
  listGames(seriesId: string): RepositoryResult<StoredGame[]>;
  getGame(seriesId: string, gameNumber: number): RepositoryResult<StoredGame>;
  updateGame(seriesId: string, game: NewGame): RepositoryResult<StoredGame>;
  deleteGame(seriesId: string, gameNumber: number): RepositoryResult<void>;
  clearGames(seriesId: string): RepositoryResult<{ deletedGames: number; updatedAt: string }>;
  setWinner(seriesId: string, gameNumber: number, winner: 'blue' | 'red' | null): RepositoryResult<StoredGame>;
  listEvents(seriesId: string, limit: number, offset: number): RepositoryResult<Page<SeriesEvent>>;
}
