import { ApiFault } from '../errors.ts';
import type { NewGame, Page, SeriesEvent, SeriesRepository, SeriesSummary, StoredGame, StoredSeries } from '../types.ts';

type SqlValue = string | number | null;

export interface D1StatementLike {
  bind(...values: SqlValue[]): D1StatementLike;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<unknown[]>;
}

interface SeriesRow { series_id: string; created_at: string; updated_at: string }
interface GameRow { game_number: number; blue_team: string; red_team: string; winner: string | null; created_at: string }
interface EventRow { id: number; type: SeriesEvent['type']; game_number: number | null; timestamp: string; details: string }

function teamFromJson(json: string): number[] {
  const team: unknown = JSON.parse(json);
  if (!Array.isArray(team) || team.length !== 5 || !team.every((id) => Number.isSafeInteger(id) && id > 0)) {
    throw new Error('Datos de equipo dañados en la base de datos.');
  }
  return team as number[];
}

function toGame(row: GameRow): StoredGame {
  return {
    gameNumber: row.game_number,
    blueTeam: teamFromJson(row.blue_team),
    redTeam: teamFromJson(row.red_team),
    winner: row.winner === 'blue' || row.winner === 'red' ? row.winner : null,
    createdAt: row.created_at,
  };
}

function usedChampionIds(games: StoredGame[]): number[] {
  return [...new Set(games.flatMap((game) => [...game.blueTeam, ...game.redTeam]))];
}

export class D1SeriesRepository implements SeriesRepository {
  private readonly database: D1DatabaseLike;

  constructor(database: D1DatabaseLike) {
    this.database = database;
  }

  async checkHealth(): Promise<void> {
    await this.database.prepare('SELECT COUNT(*) AS count FROM series').first<{ count: number }>();
  }

  async countSeries(): Promise<number> {
    const row = await this.database.prepare('SELECT COUNT(*) AS count FROM series').first<{ count: number }>();
    return row?.count ?? 0;
  }

  async listSeries(limit: number, offset: number): Promise<Page<SeriesSummary>> {
    const rows = await this.database.prepare(`
      SELECT s.series_id AS seriesId, s.updated_at AS updatedAt, COUNT(g.game_number) AS gamesCount
      FROM series s LEFT JOIN games g ON g.series_id = s.series_id
      GROUP BY s.series_id ORDER BY s.updated_at DESC, s.series_id ASC LIMIT ? OFFSET ?
    `).bind(limit, offset).all<SeriesSummary>();
    return { items: rows.results, total: await this.countSeries(), limit, offset };
  }

  async createSeries(seriesId: string): Promise<StoredSeries> {
    if (await this.seriesExists(seriesId)) throw new ApiFault(409, 'series_already_exists', 'La serie ya existe.');
    const now = new Date().toISOString();
    await this.database.batch([
      this.database.prepare('INSERT INTO series (series_id, created_at, updated_at) VALUES (?, ?, ?)').bind(seriesId, now, now),
      this.event(seriesId, 'series_created', null, now, {}),
    ]);
    return { seriesId, createdAt: now, updatedAt: now, games: [], usedChampions: [] };
  }

  async getSeries(seriesId: string): Promise<StoredSeries | null> {
    const row = await this.database.prepare('SELECT series_id, created_at, updated_at FROM series WHERE series_id = ?')
      .bind(seriesId).first<SeriesRow>();
    if (!row) return null;
    const games = await this.readGames(seriesId);
    return { seriesId: row.series_id, createdAt: row.created_at, updatedAt: row.updated_at, games, usedChampions: usedChampionIds(games) };
  }

  async deleteSeries(seriesId: string): Promise<boolean> {
    const result = await this.database.prepare('DELETE FROM series WHERE series_id = ?').bind(seriesId).run();
    return result.meta.changes > 0;
  }

  async getUsedChampions(seriesId: string): Promise<number[] | null> {
    if (!await this.seriesExists(seriesId)) return null;
    return usedChampionIds(await this.readGames(seriesId));
  }

  async addGame(seriesId: string, game: NewGame): Promise<StoredGame> {
    await this.assertSeries(seriesId);
    if (await this.database.prepare('SELECT 1 FROM games WHERE series_id = ? AND game_number = ?')
      .bind(seriesId, game.gameNumber).first()) {
      throw new ApiFault(409, 'game_number_exists', 'Ya existe esa partida en la serie.');
    }
    await this.assertChampionsAvailable(seriesId, game, null);
    const now = new Date().toISOString();
    await this.database.batch([
      this.database.prepare('INSERT INTO games (series_id, game_number, blue_team, red_team, winner, created_at) VALUES (?, ?, ?, ?, NULL, ?)')
        .bind(seriesId, game.gameNumber, JSON.stringify(game.blueTeam), JSON.stringify(game.redTeam), now),
      this.touch(seriesId, now),
      this.event(seriesId, 'game_created', game.gameNumber, now, { blueTeam: game.blueTeam, redTeam: game.redTeam }),
    ]);
    return { ...game, winner: null, createdAt: now };
  }

  async listGames(seriesId: string): Promise<StoredGame[]> {
    await this.assertSeries(seriesId);
    return this.readGames(seriesId);
  }

  async getGame(seriesId: string, gameNumber: number): Promise<StoredGame> {
    await this.assertSeries(seriesId);
    const row = await this.database.prepare('SELECT game_number, blue_team, red_team, winner, created_at FROM games WHERE series_id = ? AND game_number = ?')
      .bind(seriesId, gameNumber).first<GameRow>();
    if (!row) throw new ApiFault(404, 'game_not_found', 'La partida no existe.');
    return toGame(row);
  }

  async updateGame(seriesId: string, game: NewGame): Promise<StoredGame> {
    const previous = await this.getGame(seriesId, game.gameNumber);
    await this.assertChampionsAvailable(seriesId, game, game.gameNumber);
    const now = new Date().toISOString();
    await this.database.batch([
      this.database.prepare('UPDATE games SET blue_team = ?, red_team = ? WHERE series_id = ? AND game_number = ?')
        .bind(JSON.stringify(game.blueTeam), JSON.stringify(game.redTeam), seriesId, game.gameNumber),
      this.touch(seriesId, now),
      this.event(seriesId, 'game_updated', game.gameNumber, now, {
        before: { blueTeam: previous.blueTeam, redTeam: previous.redTeam },
        after: { blueTeam: game.blueTeam, redTeam: game.redTeam },
      }),
    ]);
    return { ...previous, blueTeam: game.blueTeam, redTeam: game.redTeam };
  }

  async deleteGame(seriesId: string, gameNumber: number): Promise<void> {
    const game = await this.getGame(seriesId, gameNumber);
    const now = new Date().toISOString();
    await this.database.batch([
      this.database.prepare('DELETE FROM games WHERE series_id = ? AND game_number = ?').bind(seriesId, gameNumber),
      this.touch(seriesId, now),
      this.event(seriesId, 'game_deleted', gameNumber, now, { blueTeam: game.blueTeam, redTeam: game.redTeam, winner: game.winner }),
    ]);
  }

  async setWinner(seriesId: string, gameNumber: number, winner: 'blue' | 'red' | null): Promise<StoredGame> {
    const game = await this.getGame(seriesId, gameNumber);
    if (game.winner === winner) return game;
    const now = new Date().toISOString();
    await this.database.batch([
      this.database.prepare('UPDATE games SET winner = ? WHERE series_id = ? AND game_number = ?').bind(winner, seriesId, gameNumber),
      this.touch(seriesId, now),
      this.event(seriesId, 'winner_changed', gameNumber, now, { before: game.winner, after: winner }),
    ]);
    return { ...game, winner };
  }

  async clearGames(seriesId: string): Promise<{ deletedGames: number; updatedAt: string }> {
    await this.assertSeries(seriesId);
    const count = await this.database.prepare('SELECT COUNT(*) AS count FROM games WHERE series_id = ?')
      .bind(seriesId).first<{ count: number }>();
    const deletedGames = count?.count ?? 0;
    const updatedAt = new Date().toISOString();
    await this.database.batch([
      this.database.prepare('DELETE FROM games WHERE series_id = ?').bind(seriesId),
      this.touch(seriesId, updatedAt),
      this.event(seriesId, 'games_cleared', null, updatedAt, { deletedGames }),
    ]);
    return { deletedGames, updatedAt };
  }

  async listEvents(seriesId: string, limit: number, offset: number): Promise<Page<SeriesEvent>> {
    await this.assertSeries(seriesId);
    const total = await this.database.prepare('SELECT COUNT(*) AS count FROM events WHERE series_id = ?')
      .bind(seriesId).first<{ count: number }>();
    const rows = await this.database.prepare('SELECT id, type, game_number, timestamp, details FROM events WHERE series_id = ? ORDER BY id ASC LIMIT ? OFFSET ?')
      .bind(seriesId, limit, offset).all<EventRow>();
    return {
      items: rows.results.map((row) => ({ id: row.id, type: row.type, gameNumber: row.game_number, timestamp: row.timestamp, details: JSON.parse(row.details) as Record<string, unknown> })),
      total: total?.count ?? 0, limit, offset,
    };
  }

  private async seriesExists(seriesId: string): Promise<boolean> {
    return Boolean(await this.database.prepare('SELECT 1 FROM series WHERE series_id = ?').bind(seriesId).first());
  }

  private async assertSeries(seriesId: string): Promise<void> {
    if (!await this.seriesExists(seriesId)) throw new ApiFault(404, 'series_not_found', 'La serie no existe.');
  }

  private async assertChampionsAvailable(seriesId: string, game: NewGame, exceptGameNumber: number | null): Promise<void> {
    const saved = (await this.readGames(seriesId)).filter((item) => item.gameNumber !== exceptGameNumber);
    const used = new Set(usedChampionIds(saved));
    if ([...game.blueTeam, ...game.redTeam].some((id) => used.has(id))) {
      throw new ApiFault(409, 'champion_already_used', 'Un campeón ya se usó en esta serie.');
    }
  }

  private async readGames(seriesId: string): Promise<StoredGame[]> {
    const rows = await this.database.prepare('SELECT game_number, blue_team, red_team, winner, created_at FROM games WHERE series_id = ? ORDER BY game_number ASC')
      .bind(seriesId).all<GameRow>();
    return rows.results.map(toGame);
  }

  private touch(seriesId: string, timestamp: string): D1StatementLike {
    return this.database.prepare('UPDATE series SET updated_at = ? WHERE series_id = ?').bind(timestamp, seriesId);
  }

  private event(seriesId: string, type: SeriesEvent['type'], gameNumber: number | null, timestamp: string, details: Record<string, unknown>): D1StatementLike {
    return this.database.prepare('INSERT INTO events (series_id, type, game_number, timestamp, details) VALUES (?, ?, ?, ?, ?)')
      .bind(seriesId, type, gameNumber, timestamp, JSON.stringify(details));
  }
}
