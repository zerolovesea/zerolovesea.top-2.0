CREATE TABLE IF NOT EXISTS views (
	slug TEXT PRIMARY KEY,
	count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS visits (
	id INTEGER PRIMARY KEY,
	slug TEXT NOT NULL,
	viewed_at TEXT NOT NULL,
	country TEXT,
	city TEXT,
	language TEXT,
	visitor_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_visits_slug ON visits (slug);
CREATE INDEX IF NOT EXISTS idx_visits_viewed_at ON visits (viewed_at);
