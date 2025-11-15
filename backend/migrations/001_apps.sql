CREATE TABLE IF NOT EXISTS apps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  protocol     TEXT NOT NULL,          -- http|https|tcp
  host         TEXT NOT NULL,
  port         INTEGER NOT NULL,
  path         TEXT DEFAULT '/',
  tag          TEXT NULL,              -- ex: "production", "dev"
  icon         TEXT NULL,              -- nom d'icône lucide-react
  health_path  TEXT DEFAULT '/health', -- chemin pour health check HTTP
  health_type  TEXT DEFAULT 'http',    -- http|tcp
  created_at   TEXT DEFAULT (datetime('now'))
);
