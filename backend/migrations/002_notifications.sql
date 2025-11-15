CREATE TABLE IF NOT EXISTS alerts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT NOT NULL,          -- ex: app:<id>, vm:<vmid>, node:<name>
  severity     TEXT NOT NULL,          -- info|warning|critical
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  payload      TEXT NULL,              -- JSON extra
  created_at   TEXT DEFAULT (datetime('now')),
  acknowledged INTEGER DEFAULT 0       -- 0/1
);

CREATE TABLE IF NOT EXISTS notify_subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  channel      TEXT NOT NULL,          -- email|webhook|sse
  endpoint     TEXT NOT NULL,          -- email addr / URL / ("sse" placeholder)
  enabled      INTEGER DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_queue (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  to_addr      TEXT NOT NULL,
  subject      TEXT NOT NULL,
  body_text    TEXT NOT NULL,
  state        TEXT DEFAULT 'queued',  -- queued|sent|error
  last_error   TEXT NULL,
  created_at   TEXT DEFAULT (datetime('now')),
  sent_at      TEXT NULL
);
