// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { ensureD1Schema } from '../../server/d1Schema.ts';
import type { D1DatabaseLike, D1StatementLike } from '../../server/repositories/d1Repository.ts';

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

class SqliteD1Statement implements D1StatementLike {
  private readonly database: DatabaseSync;
  private readonly query: string;
  private values: (string | number | null)[] = [];

  constructor(database: DatabaseSync, query: string) {
    this.database = database;
    this.query = query;
  }

  bind(...values: (string | number | null)[]): this {
    this.values = values;
    return this;
  }

  first<T>(): Promise<T | null> {
    return Promise.resolve((this.database.prepare(this.query).get(...this.values) as T | undefined) ?? null);
  }

  all<T>(): Promise<{ results: T[] }> {
    return Promise.resolve({ results: this.database.prepare(this.query).all(...this.values) as T[] });
  }

  run(): Promise<{ meta: { changes: number } }> {
    const result = this.database.prepare(this.query).run(...this.values);
    return Promise.resolve({ meta: { changes: Number(result.changes) } });
  }
}

class SqliteD1 implements D1DatabaseLike {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  prepare(query: string): D1StatementLike {
    return new SqliteD1Statement(this.database, query);
  }

  async batch(statements: D1StatementLike[]): Promise<unknown[]> {
    this.database.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

function createD1(): SqliteD1 {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  return new SqliteD1(database);
}

describe('esquema D1 de producción', () => {
  it('crea el esquema nuevo y es segura al ejecutarse otra vez', async () => {
    const db = createD1();
    await ensureD1Schema(db);
    await ensureD1Schema(db);

    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>();
    expect(tables.results.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'series', 'games', 'events', 'game_champions', '_fearless_site_migrations',
    ]));
    const migration = await db.prepare('SELECT state FROM _fearless_site_migrations').first<{ state: string }>();
    expect(migration?.state).toBe('done');
  });

  it('actualiza el esquema antiguo preservando series, partidas y fechas', async () => {
    const db = createD1();
    await db.prepare(`CREATE TABLE series (
      id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`).run();
    await db.prepare(`CREATE TABLE games (
      series_id TEXT NOT NULL, game_number INTEGER NOT NULL, blue_team TEXT NOT NULL,
      red_team TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (series_id, game_number)
    )`).run();
    await db.prepare('INSERT INTO series VALUES (?, ?, ?)').bind('fearless-legacy', 1780000000000, 1780000000000).run();
    await db.prepare('INSERT INTO games VALUES (?, ?, ?, ?, ?)')
      .bind('fearless-legacy', 1, '[1,2,3,4,5]', '[6,7,8,9,10]', 1780000000000).run();

    await ensureD1Schema(db);
    const series = await db.prepare('SELECT series_id, created_at FROM series').first<{ series_id: string; created_at: string }>();
    const game = await db.prepare('SELECT game_number, blue_team, winner, created_at FROM games').first<{
      game_number: number; blue_team: string; winner: string | null; created_at: string;
    }>();
    const champions = await db.prepare('SELECT COUNT(*) AS count FROM game_champions').first<{ count: number }>();

    expect(series).toMatchObject({ series_id: 'fearless-legacy', created_at: '2026-05-28T20:26:40.000Z' });
    expect(game).toMatchObject({ game_number: 1, blue_team: '[1,2,3,4,5]', winner: null });
    expect(game?.created_at).toBe('2026-05-28T20:26:40.000Z');
    expect(champions?.count).toBe(10);
  });

  it('detecta un esquema actual aplicado manualmente sin recrear las tablas', async () => {
    const db = createD1();
    await db.prepare('CREATE TABLE series (series_id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)').run();
    await db.prepare('CREATE TABLE games (series_id TEXT NOT NULL, game_number INTEGER NOT NULL, blue_team TEXT NOT NULL, red_team TEXT NOT NULL, winner TEXT, created_at TEXT NOT NULL)').run();
    await db.prepare('CREATE TABLE events (id INTEGER PRIMARY KEY, series_id TEXT NOT NULL)').run();
    await db.prepare('CREATE TABLE game_champions (series_id TEXT NOT NULL, champion_id INTEGER NOT NULL)').run();
    await db.prepare('INSERT INTO series VALUES (?, ?, ?)').bind('already-current', '2026-09-28T00:00:00.000Z', '2026-09-28T00:00:00.000Z').run();

    await ensureD1Schema(db);
    const marker = await db.prepare('SELECT state FROM _fearless_site_migrations').first<{ state: string }>();
    const series = await db.prepare('SELECT series_id FROM series').first<{ series_id: string }>();
    expect(marker?.state).toBe('done');
    expect(series?.series_id).toBe('already-current');
  });
});
