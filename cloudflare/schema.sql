CREATE TABLE IF NOT EXISTS history_snapshot (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  catalog TEXT NOT NULL,
  history TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
