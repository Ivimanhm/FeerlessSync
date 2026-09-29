import { DatabaseSync } from 'node:sqlite';
import { ApiFault } from '../errors.ts';
import type { NewGame, Page, SeriesEvent, SeriesRepository, SeriesSummary, StoredGame, StoredSeries } from '../types.ts';

interface SeriesRow { series_id: string; created_at: string; updated_at: string }
interface GameRow { game_number: number; blue_team: string; red_team: string; winner: string | null; created_at: string }
interface EventRow { id: number; type: SeriesEvent['type']; game_number: number | null; timestamp: string; details: string }

function readTeam(json: string): number[] {
  const value: unknown = JSON.parse(json);
  if (!Array.isArray(value) || value.length !== 5 || !value.every((id) => Number.isSafeInteger(id) && id > 0)) {
    throw new Error('Datos de equipo dañados en la base de datos.');
  }
  return value as number[];
}

function toGame(row: GameRow): StoredGame {
  return {
    gameNumber: row.game_number,
    blueTeam: readTeam(row.blue_team),
    redTeam: readTeam(row.red_team),
    winner: row.winner === 'blue' || row.winner === 'red' ? row.winner : null,
    createdAt: row.created_at,
  };
}

export class SqliteSeriesRepository implements SeriesRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS series (
        series_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS games (
        series_id TEXT NOT NULL REFERENCES series(series_id) ON DELETE CASCADE,
        game_number INTEGER NOT NULL CHECK (game_number > 0),
        blue_team TEXT NOT NULL,
        red_team TEXT NOT NULL,
        winner TEXT CHECK (winner IN ('blue', 'red') OR winner IS NULL),
        created_at TEXT NOT NULL,
        PRIMARY KEY (series_id, game_number)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        series_id TEXT NOT NULL REFERENCES series(series_id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        game_number INTEGER,
        timestamp TEXT NOT NULL,
        details TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS events_by_series ON events(series_id, id);
    `);
  }

  checkHealth(): void {
    this.database.prepare('SELECT 1').get();
  }

  countSeries(): number {
    return (this.database.prepare('SELECT COUNT(*) AS count FROM series').get() as { count: number }).count;
  }

  listSeries(limit: number, offset: number): Page<SeriesSummary> {
    const rows = this.database.prepare(`
      SELECT s.series_id AS seriesId, s.updated_at AS updatedAt, COUNT(g.game_number) AS gamesCount
      FROM series s LEFT JOIN games g ON g.series_id = s.series_id
      GROUP BY s.series_id ORDER BY s.updated_at DESC, s.series_id ASC LIMIT ? OFFSET ?
    `).all(limit, offset) as unknown as SeriesSummary[];
    return { items: rows, total: this.countSeries(), limit, offset };
  }

  createSeries(seriesId: string): StoredSeries {
    return this.transaction(() => {
      const now = new Date().toISOString();
      const result = this.database.prepare('INSERT OR IGNORE INTO series (series_id, created_at, updated_at) VALUES (?, ?, ?)').run(seriesId, now, now);
      if (result.changes === 0) throw new ApiFault(409, 'series_already_exists', 'La serie ya existe.');
      this.event(seriesId, 'series_created', null, now, {});
      return { seriesId, createdAt: now, updatedAt: now, games: [], usedChampions: [] };
    });
  }

  getSeries(seriesId: string): StoredSeries | null {
    const row = this.database.prepare('SELECT series_id, created_at, updated_at FROM series WHERE series_id = ?').get(seriesId) as SeriesRow | undefined;
    if (!row) return null;
    const games = this.readGames(seriesId);
    return {
      seriesId: row.series_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      games,
      usedChampions: this.uniqueChampionIds(games),
    };
  }

  deleteSeries(seriesId: string): boolean {
    return this.database.prepare('DELETE FROM series WHERE series_id = ?').run(seriesId).changes > 0;
  }

  getUsedChampions(seriesId: string): number[] | null {
    if (!this.database.prepare('SELECT 1 FROM series WHERE series_id = ?').get(seriesId)) return null;
    return this.uniqueChampionIds(this.readGames(seriesId));
  }

  addGame(seriesId: string, game: NewGame): StoredGame {
    return this.transaction(() => {
      this.assertSeries(seriesId);
      if (this.database.prepare('SELECT 1 FROM games WHERE series_id = ? AND game_number = ?').get(seriesId, game.gameNumber)) {
        throw new ApiFault(409, 'game_number_exists', 'Ya existe esa partida en la serie.');
      }
      this.assertChampionsAvailable(seriesId, game, null);
      const now = new Date().toISOString();
      this.database.prepare('INSERT INTO games (series_id, game_number, blue_team, red_team, winner, created_at) VALUES (?, ?, ?, ?, NULL, ?)')
        .run(seriesId, game.gameNumber, JSON.stringify(game.blueTeam), JSON.stringify(game.redTeam), now);
      this.touch(seriesId, now);
      this.event(seriesId, 'game_created', game.gameNumber, now, { blueTeam: game.blueTeam, redTeam: game.redTeam });
      return { ...game, winner: null, createdAt: now };
    });
  }

  listGames(seriesId: string): StoredGame[] {
    this.assertSeries(seriesId);
    return this.readGames(seriesId);
  }

  getGame(seriesId: string, gameNumber: number): StoredGame {
    this.assertSeries(seriesId);
    const row = this.database.prepare('SELECT game_number, blue_team, red_team, winner, created_at FROM games WHERE series_id = ? AND game_number = ?')
      .get(seriesId, gameNumber) as GameRow | undefined;
    if (!row) throw new ApiFault(404, 'game_not_found', 'La partida no existe.');
    return toGame(row);
  }

  updateGame(seriesId: string, game: NewGame): StoredGame {
    return this.transaction(() => {
      const previous = this.getGame(seriesId, game.gameNumber);
      this.assertChampionsAvailable(seriesId, game, game.gameNumber);
      this.database.prepare('UPDATE games SET blue_team = ?, red_team = ? WHERE series_id = ? AND game_number = ?')
        .run(JSON.stringify(game.blueTeam), JSON.stringify(game.redTeam), seriesId, game.gameNumber);
      const now = new Date().toISOString();
      this.touch(seriesId, now);
      this.event(seriesId, 'game_updated', game.gameNumber, now, {
        before: { blueTeam: previous.blueTeam, redTeam: previous.redTeam },
        after: { blueTeam: game.blueTeam, redTeam: game.redTeam },
      });
      return { ...previous, blueTeam: game.blueTeam, redTeam: game.redTeam };
    });
  }

  deleteGame(seriesId: string, gameNumber: number): void {
    this.transaction(() => {
      const game = this.getGame(seriesId, gameNumber);
      this.database.prepare('DELETE FROM games WHERE series_id = ? AND game_number = ?').run(seriesId, gameNumber);
      const now = new Date().toISOString();
      this.touch(seriesId, now);
      this.event(seriesId, 'game_deleted', gameNumber, now, { blueTeam: game.blueTeam, redTeam: game.redTeam, winner: game.winner });
    });
  }

  setWinner(seriesId: string, gameNumber: number, winner: 'blue' | 'red' | null): StoredGame {
    return this.transaction(() => {
      const game = this.getGame(seriesId, gameNumber);
      if (game.winner === winner) return game;
      this.database.prepare('UPDATE games SET winner = ? WHERE series_id = ? AND game_number = ?').run(winner, seriesId, gameNumber);
      const now = new Date().toISOString();
      this.touch(seriesId, now);
      this.event(seriesId, 'winner_changed', gameNumber, now, { before: game.winner, after: winner });
      return { ...game, winner };
    });
  }

  clearGames(seriesId: string): { deletedGames: number; updatedAt: string } {
    return this.transaction(() => {
      this.assertSeries(seriesId);
      const deletedGames = Number(this.database.prepare('DELETE FROM games WHERE series_id = ?').run(seriesId).changes);
      const updatedAt = new Date().toISOString();
      this.touch(seriesId, updatedAt);
      this.event(seriesId, 'games_cleared', null, updatedAt, { deletedGames });
      return { deletedGames, updatedAt };
    });
  }

  listEvents(seriesId: string, limit: number, offset: number): Page<SeriesEvent> {
    this.assertSeries(seriesId);
    const total = (this.database.prepare('SELECT COUNT(*) AS count FROM events WHERE series_id = ?').get(seriesId) as { count: number }).count;
    const rows = this.database.prepare('SELECT id, type, game_number, timestamp, details FROM events WHERE series_id = ? ORDER BY id ASC LIMIT ? OFFSET ?')
      .all(seriesId, limit, offset) as unknown as EventRow[];
    return {
      items: rows.map((row) => ({ id: row.id, type: row.type, gameNumber: row.game_number, timestamp: row.timestamp, details: JSON.parse(row.details) as Record<string, unknown> })),
      total, limit, offset,
    };
  }

  private transaction<T>(action: () => T): T {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  private assertSeries(seriesId: string): void {
    if (!this.database.prepare('SELECT 1 FROM series WHERE series_id = ?').get(seriesId)) {
      throw new ApiFault(404, 'series_not_found', 'La serie no existe.');
    }
  }

  private assertChampionsAvailable(seriesId: string, game: NewGame, exceptGameNumber: number | null): void {
    const used = new Set(this.uniqueChampionIds(this.readGames(seriesId).filter((saved) => saved.gameNumber !== exceptGameNumber)));
    if ([...game.blueTeam, ...game.redTeam].some((id) => used.has(id))) {
      throw new ApiFault(409, 'champion_already_used', 'Un campeón ya se usó en esta serie.');
    }
  }

  private touch(seriesId: string, timestamp: string): void {
    this.database.prepare('UPDATE series SET updated_at = ? WHERE series_id = ?').run(timestamp, seriesId);
  }

  private event(seriesId: string, type: SeriesEvent['type'], gameNumber: number | null, timestamp: string, details: Record<string, unknown>): void {
    this.database.prepare('INSERT INTO events (series_id, type, game_number, timestamp, details) VALUES (?, ?, ?, ?, ?)')
      .run(seriesId, type, gameNumber, timestamp, JSON.stringify(details));
  }

  private readGames(seriesId: string): StoredGame[] {
    const rows = this.database.prepare('SELECT game_number, blue_team, red_team, winner, created_at FROM games WHERE series_id = ? ORDER BY game_number ASC')
      .all(seriesId) as unknown as GameRow[];
    return rows.map(toGame);
  }

  private uniqueChampionIds(games: StoredGame[]): number[] {
    return [...new Set(games.flatMap((game) => [...game.blueTeam, ...game.redTeam]))];
  }
}
