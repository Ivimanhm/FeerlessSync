import type { D1DatabaseLike, D1StatementLike } from './repositories/d1Repository.ts';

const migrationVersion = 'series-games-events-v1';
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const seriesTable = (name = 'series') => `CREATE TABLE ${name} (
  series_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT`;

const gamesTable = (series = 'series', name = 'games') => `CREATE TABLE ${name} (
  series_id TEXT NOT NULL REFERENCES ${series}(series_id) ON DELETE CASCADE,
  game_number INTEGER NOT NULL CHECK (game_number > 0),
  blue_team TEXT NOT NULL,
  red_team TEXT NOT NULL,
  winner TEXT CHECK (winner IN ('blue', 'red') OR winner IS NULL),
  created_at TEXT NOT NULL,
  PRIMARY KEY (series_id, game_number)
) STRICT`;

const eventsTable = (series = 'series', name = 'events') => `CREATE TABLE ${name} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id TEXT NOT NULL REFERENCES ${series}(series_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  game_number INTEGER,
  timestamp TEXT NOT NULL,
  details TEXT NOT NULL
) STRICT`;

function championIndexTable(series = 'series', games = 'games', name = 'game_champions') {
  return `CREATE TABLE ${name} (
    series_id TEXT NOT NULL,
    game_number INTEGER NOT NULL,
    champion_id INTEGER NOT NULL,
    PRIMARY KEY (series_id, champion_id),
    FOREIGN KEY (series_id, game_number) REFERENCES ${games}(series_id, game_number) ON DELETE CASCADE,
    FOREIGN KEY (series_id) REFERENCES ${series}(series_id) ON DELETE CASCADE
  ) STRICT`;
}

function championTriggers(games = 'games', champions = 'game_champions') {
  return [
    `CREATE TRIGGER ${games}_record_champions AFTER INSERT ON ${games} BEGIN
      INSERT INTO ${champions} (series_id, game_number, champion_id)
      SELECT NEW.series_id, NEW.game_number, CAST(value AS INTEGER) FROM json_each(NEW.blue_team)
      UNION ALL
      SELECT NEW.series_id, NEW.game_number, CAST(value AS INTEGER) FROM json_each(NEW.red_team);
    END`,
    `CREATE TRIGGER ${games}_update_champions AFTER UPDATE OF blue_team, red_team ON ${games} BEGIN
      DELETE FROM ${champions} WHERE series_id = OLD.series_id AND game_number = OLD.game_number;
      INSERT INTO ${champions} (series_id, game_number, champion_id)
      SELECT NEW.series_id, NEW.game_number, CAST(value AS INTEGER) FROM json_each(NEW.blue_team)
      UNION ALL
      SELECT NEW.series_id, NEW.game_number, CAST(value AS INTEGER) FROM json_each(NEW.red_team);
    END`,
  ];
}

function migrationStatements(db: D1DatabaseLike, legacy: boolean): D1StatementLike[] {
  if (!legacy) {
    return [
      db.prepare(seriesTable()),
      db.prepare(gamesTable()),
      db.prepare(eventsTable()),
      db.prepare(championIndexTable()),
      db.prepare('CREATE INDEX events_by_series ON events(series_id, id)'),
      ...championTriggers().map((sql) => db.prepare(sql)),
    ];
  }

  const legacyTime = (column: string) => `CASE
    WHEN typeof(${column}) IN ('integer', 'real') THEN strftime('%Y-%m-%dT%H:%M:%fZ', ${column} / 1000.0, 'unixepoch')
    WHEN typeof(${column}) = 'text' AND length(trim(${column})) >= 12 AND trim(${column}) NOT GLOB '*[^0-9]*'
      THEN strftime('%Y-%m-%dT%H:%M:%fZ', CAST(trim(${column}) AS REAL) / 1000.0, 'unixepoch')
    ELSE CAST(${column} AS TEXT)
  END`;

  return [
    db.prepare(seriesTable('series_v2')),
    db.prepare(gamesTable('series_v2', 'games_v2')),
    db.prepare(eventsTable('series_v2', 'events_v2')),
    db.prepare(championIndexTable('series_v2', 'games_v2', 'game_champions_v2')),
    db.prepare(`INSERT INTO series_v2 (series_id, created_at, updated_at)
      SELECT id, ${legacyTime('created_at')}, ${legacyTime('updated_at')} FROM series`),
    db.prepare(`INSERT INTO games_v2 (series_id, game_number, blue_team, red_team, winner, created_at)
      SELECT series_id, game_number, blue_team, red_team, NULL, ${legacyTime('created_at')} FROM games`),
    db.prepare(`INSERT INTO game_champions_v2 (series_id, game_number, champion_id)
      SELECT series_id, game_number, CAST(champion.value AS INTEGER)
      FROM games_v2
      CROSS JOIN json_each(games_v2.blue_team) AS champion
      UNION ALL
      SELECT series_id, game_number, CAST(champion.value AS INTEGER)
      FROM games_v2
      CROSS JOIN json_each(games_v2.red_team) AS champion`),
    db.prepare('DROP TABLE games'),
    db.prepare('DROP TABLE series'),
    db.prepare('ALTER TABLE series_v2 RENAME TO series'),
    db.prepare('ALTER TABLE games_v2 RENAME TO games'),
    db.prepare('ALTER TABLE events_v2 RENAME TO events'),
    db.prepare('ALTER TABLE game_champions_v2 RENAME TO game_champions'),
    db.prepare('CREATE INDEX events_by_series ON events(series_id, id)'),
    ...championTriggers().map((sql) => db.prepare(sql)),
  ];
}

/** Upgrade the earlier Sites schema in-place, retaining all series and matches. */
export async function ensureD1Schema(db: D1DatabaseLike): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS _fearless_site_migrations (
    version TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    lock_id TEXT,
    updated_at INTEGER NOT NULL
  ) STRICT`).run();

  const existing = await db.prepare('SELECT state FROM _fearless_site_migrations WHERE version = ?')
    .bind(migrationVersion).first<{ state: string }>();
  if (existing?.state === 'done') return;

  const lockId = crypto.randomUUID();
  const now = Date.now();
  const lock = await db.prepare(`INSERT INTO _fearless_site_migrations (version, state, lock_id, updated_at)
    VALUES (?, 'running', ?, ?)
    ON CONFLICT(version) DO UPDATE SET state = 'running', lock_id = excluded.lock_id, updated_at = excluded.updated_at
    WHERE _fearless_site_migrations.state = 'running' AND _fearless_site_migrations.updated_at < ?`)
    .bind(migrationVersion, lockId, now, now - 300_000).run();

  if (!lock.meta.changes) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const state = await db.prepare('SELECT state FROM _fearless_site_migrations WHERE version = ?')
        .bind(migrationVersion).first<{ state: string }>();
      if (state?.state === 'done') return;
      await wait(50);
    }
    throw new Error('La actualización de la base de datos sigue en curso.');
  }

  try {
    const columns = await db.prepare('PRAGMA table_info(series)').all<{ name: string }>();
    const names = new Set(columns.results.map((column) => column.name));
    const legacy = names.has('id') && !names.has('series_id');
    if (names.size && !legacy && !names.has('series_id')) {
      throw new Error('El esquema de series no es compatible; no se modificaron los datos.');
    }

    if (names.has('series_id')) {
      const tables = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all<{ name: string }>();
      const existingTables = new Set(tables.results.map((table) => table.name));
      if (!['games', 'events', 'game_champions'].every((table) => existingTables.has(table))) {
        throw new Error('El esquema de series está incompleto; no se modificaron los datos.');
      }
      await db.prepare(`UPDATE _fearless_site_migrations SET state = 'done', lock_id = NULL, updated_at = ? WHERE version = ? AND lock_id = ?`)
        .bind(Date.now(), migrationVersion, lockId).run();
      return;
    }

    const statements = migrationStatements(db, legacy);
    statements.push(db.prepare(`UPDATE _fearless_site_migrations SET state = 'done', lock_id = NULL, updated_at = ? WHERE version = ? AND lock_id = ?`)
      .bind(Date.now(), migrationVersion, lockId));
    await db.batch(statements);
  } catch (error) {
    await db.prepare('DELETE FROM _fearless_site_migrations WHERE version = ? AND lock_id = ? AND state = ?')
      .bind(migrationVersion, lockId, 'running').run();
    throw error;
  }
}
