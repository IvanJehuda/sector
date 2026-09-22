import type { Db } from './client';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  expires_at INTEGER
);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  path TEXT NOT NULL,
  cost INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  url TEXT UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TEXT NOT NULL,
  symbols TEXT NOT NULL,
  tags TEXT NOT NULL,
  sub_sectors TEXT NOT NULL,
  status TEXT NOT NULL,
  status_message TEXT,
  created_at TEXT NOT NULL,
  status_updated_at TEXT
);
CREATE TABLE IF NOT EXISTS reports (
  event_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  event_type TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export async function migrate(db: Db): Promise<void> {
  await db.executeMultiple(SCHEMA);
  const cols = await db.execute('PRAGMA table_info(events)');
  if (!cols.rows.some((r) => String(r.name) === 'status_updated_at')) {
    await db.execute('ALTER TABLE events ADD COLUMN status_updated_at TEXT');
  }
}
