CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL CHECK (currency IN ('TWD', 'KRW')),
    category TEXT NOT NULL CHECK (category IN ('FOOD', 'TRANSPORT', 'CAFE', 'SHOPPING', 'ETC')),
    memo TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_created_at
ON expenses(created_at DESC);

CREATE TABLE IF NOT EXISTS trip_memo (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    content TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

PRAGMA optimize;
