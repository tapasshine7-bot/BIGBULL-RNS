-- Apply this file only to bigbull-rns-toolmanager-preview-db.
-- It contains no production data and no cheat/mod-panel destination.

CREATE TABLE IF NOT EXISTS managed_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  logo_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  placement TEXT NOT NULL CHECK (placement IN ('dashboard', 'vip')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  position INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visit_counters (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  device TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (day, path, device)
);

CREATE TABLE IF NOT EXISTS tool_ordering (
  tool_id TEXT PRIMARY KEY,
  position INTEGER NOT NULL DEFAULT 99,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vip_blocks (
  member_key TEXT PRIMARY KEY,
  reason TEXT,
  blocked_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vip_members (
  member_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'registered',
  paid_at TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vip_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS tool_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  detail TEXT,
  contact TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS uid_seed (
  uid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'IND',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ff_sensitivity_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  ram_gb TEXT NOT NULL,
  gyro TEXT NOT NULL DEFAULT 'off',
  dpi TEXT NOT NULL DEFAULT 'standard',
  values_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ff_headshot_tips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rating_min INTEGER NOT NULL,
  rating_max INTEGER NOT NULL,
  tier TEXT NOT NULL,
  tip_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ff_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ff_uid_cache (
  uid TEXT PRIMARY KEY,
  name TEXT,
  level INTEGER,
  region TEXT,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER
);

CREATE TABLE IF NOT EXISTS bio_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'gamer',
  title TEXT NOT NULL,
  template_text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vip_guide_cards (
  tool_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  tips_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gateway_announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  audience TEXT NOT NULL DEFAULT 'all',
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO managed_tools (id, name, url, logo_url, description, placement, enabled, position, created_at, updated_at)
VALUES ('bio', 'Bio Tool', 'https://rnsbigbull.site', NULL, 'Preview baseline. Update this owner-managed card to an approved Bio Tool destination before production.', 'dashboard', 1, 10, datetime('now'), datetime('now'));
