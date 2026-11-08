CREATE TABLE IF NOT EXISTS guide_inputs (
  draw_date TEXT NOT NULL,
  lottery_id TEXT NOT NULL,
  checked_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (draw_date, lottery_id)
);
CREATE INDEX IF NOT EXISTS guide_inputs_expiry ON guide_inputs(expires_at);
