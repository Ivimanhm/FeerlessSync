// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { ensureD1Schema } from '../../server/d1Schema.ts';
import { D1SeriesRepository, type D1DatabaseLike, type D1StatementLike } from '../../server/repositories/d1Repository.ts';
import { createApiHandler } from '../../server/routes/api.ts';

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
  it('añade el estado Fearless a una base ya migrada y conserva la serie activa al reiniciar', async () => {
    const db = createD1();
    await ensureD1Schema(db);
    await db.prepare('DROP TABLE fearless_series').run();
    await ensureD1Schema(db);
    const catalogProvider = { getCatalog: async () => ({ version: '13', championIds: Array.from({ length: 13 }, (_, index) => index + 1) }) };
    const handler = createApiHandler(new D1SeriesRepository(db), { catalogProvider });
    const initial = await (await handler(new Request('http://localhost/api/fearless'))).json() as { seriesId: string };
    const saved = await handler(new Request('http://localhost/api/fearless', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesId: initial.seriesId, gameNumber: 1, blueTeam: [1, 2, 3, 4, 5], redTeam: [6, 7, 8, 9, 10] }),
    }));
    expect(saved.status).toBe(201);
    expect(await saved.json()).toMatchObject({ seriesArchived: true });
    const next = await (await handler(new Request('http://localhost/api/fearless'))).json() as { seriesId: string };
    expect(next.seriesId).not.toBe(initial.seriesId);
    await ensureD1Schema(db);
    const restarted = createApiHandler(new D1SeriesRepository(db), { catalogProvider });
    expect(await (await restarted(new Request('http://localhost/api/fearless'))).json()).toMatchObject({ seriesId: next.seriesId, availableChampionsCount: 13 });
    expect((await new D1SeriesRepository(db).getSeries(initial.seriesId))?.games).toHaveLength(1);
  });

  it('prepara una nueva serie persistida al agotar campeones y reutiliza su ID', async () => {
    const db = createD1();
    await ensureD1Schema(db);
    const repository = new D1SeriesRepository(db);
    await repository.createSeries('exhausted');
    await repository.addGame('exhausted', { gameNumber: 1, blueTeam: [1, 2, 3, 4, 5], redTeam: [6, 7, 8, 9, 10] });
    const handler = createApiHandler(repository, {
      catalogProvider: { getCatalog: async () => ({ version: 'test', championIds: Array.from({ length: 13 }, (_, index) => index + 1) }) },
    });
    const prepare = () => handler(new Request('http://localhost/api/series/exhausted/prepare', { method: 'POST' }));
    const responses = await Promise.all([prepare(), prepare()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const [first, second] = await Promise.all(responses.map((response) => response.json())) as Array<{ seriesId: string }>;
    expect(first).toMatchObject({ seriesChanged: true, availableChampionsCount: 13, nextGameNumber: 1 });
    expect(second.seriesId).toBe(first.seriesId);
    const reloaded = new D1SeriesRepository(db);
    expect(await reloaded.countSeries()).toBe(2);
    expect(await reloaded.getSeries(first.seriesId)).toMatchObject({ games: [], usedChampions: [] });
    expect((await reloaded.getSeries('exhausted'))?.games).toHaveLength(1);
  });

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
