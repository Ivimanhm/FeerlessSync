export const fearlessSchema = [
  `CREATE TABLE IF NOT EXISTS fearless_series (
    series_id TEXT PRIMARY KEY REFERENCES series(series_id) ON DELETE CASCADE,
    archived_at TEXT
  ) STRICT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS one_active_fearless_series
    ON fearless_series((1)) WHERE archived_at IS NULL`,
];
