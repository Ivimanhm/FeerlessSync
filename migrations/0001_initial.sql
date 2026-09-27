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

CREATE TABLE IF NOT EXISTS game_champions (
  series_id TEXT NOT NULL,
  game_number INTEGER NOT NULL,
  champion_id INTEGER NOT NULL,
  PRIMARY KEY (series_id, champion_id),
  FOREIGN KEY (series_id, game_number) REFERENCES games(series_id, game_number) ON DELETE CASCADE
) STRICT;

CREATE TRIGGER IF NOT EXISTS games_record_champions AFTER INSERT ON games BEGIN
  INSERT INTO game_champions (series_id, game_number, champion_id)
  SELECT NEW.series_id, NEW.game_number, CAST(value AS INTEGER) FROM json_each(NEW.blue_team)
  UNION ALL
  SELECT NEW.series_id, NEW.game_number, CAST(value AS INTEGER) FROM json_each(NEW.red_team);
END;

CREATE TRIGGER IF NOT EXISTS games_update_champions AFTER UPDATE OF blue_team, red_team ON games BEGIN
  DELETE FROM game_champions WHERE series_id = OLD.series_id AND game_number = OLD.game_number;
  INSERT INTO game_champions (series_id, game_number, champion_id)
  SELECT NEW.series_id, NEW.game_number, CAST(value AS INTEGER) FROM json_each(NEW.blue_team)
  UNION ALL
  SELECT NEW.series_id, NEW.game_number, CAST(value AS INTEGER) FROM json_each(NEW.red_team);
END;

CREATE INDEX IF NOT EXISTS events_by_series ON events(series_id, id);
