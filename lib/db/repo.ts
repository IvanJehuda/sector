import { randomUUID } from 'node:crypto';
import type { Row } from '@libsql/client';
import type { EventInput, EventSource, EventStatus, Report, StoredEvent } from '@/lib/domain';
import type { Db } from './client';

function rowToEvent(r: Row): StoredEvent {
  return {
    id: String(r.id),
    source: String(r.source) as EventSource,
    url: r.url === null ? null : String(r.url),
    title: String(r.title),
    body: String(r.body),
    publishedAt: String(r.published_at),
    symbols: JSON.parse(String(r.symbols)) as string[],
    tags: JSON.parse(String(r.tags)) as string[],
    subSectors: JSON.parse(String(r.sub_sectors)) as string[],
    status: String(r.status) as EventStatus,
    statusMessage: r.status_message === null ? null : String(r.status_message),
    createdAt: String(r.created_at),
  };
}

export async function getEvent(db: Db, id: string): Promise<StoredEvent | null> {
  const r = await db.execute({ sql: 'SELECT * FROM events WHERE id = ?', args: [id] });
  return r.rows[0] ? rowToEvent(r.rows[0]) : null;
}

export async function insertEvent(
  db: Db,
  input: EventInput,
): Promise<{ event: StoredEvent; created: boolean }> {
  if (input.url) {
    const existing = await db.execute({ sql: 'SELECT * FROM events WHERE url = ?', args: [input.url] });
    if (existing.rows[0]) return { event: rowToEvent(existing.rows[0]), created: false };
  }
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO events (id, source, url, title, body, published_at, symbols, tags, sub_sectors, status, status_message, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', NULL, ?)`,
    args: [
      id,
      input.source,
      input.url,
      input.title,
      input.body,
      input.publishedAt,
      JSON.stringify(input.symbols),
      JSON.stringify(input.tags),
      JSON.stringify(input.subSectors),
      new Date().toISOString(),
    ],
  });
  const event = await getEvent(db, id);
  if (!event) throw new Error('insertEvent: row missing after insert');
  return { event, created: true };
}

export async function listEvents(db: Db, limit = 50): Promise<StoredEvent[]> {
  const r = await db.execute({ sql: 'SELECT * FROM events ORDER BY published_at DESC LIMIT ?', args: [limit] });
  return r.rows.map(rowToEvent);
}

export async function setEventStatus(
  db: Db,
  id: string,
  status: EventStatus,
  message: string | null = null,
): Promise<void> {
  await db.execute({ sql: 'UPDATE events SET status = ?, status_message = ? WHERE id = ?', args: [status, message, id] });
}

export async function saveReport(db: Db, report: Report): Promise<void> {
  await db.execute({
    sql: 'INSERT OR REPLACE INTO reports (event_id, mode, event_type, body, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [report.eventId, report.mode, report.eventType, JSON.stringify(report), report.createdAt],
  });
}

export async function getReport(db: Db, eventId: string): Promise<Report | null> {
  const r = await db.execute({ sql: 'SELECT body FROM reports WHERE event_id = ?', args: [eventId] });
  return r.rows[0] ? (JSON.parse(String(r.rows[0].body)) as Report) : null;
}

export async function listRetrospectiveReports(db: Db): Promise<Report[]> {
  const r = await db.execute("SELECT body FROM reports WHERE mode = 'retrospective'");
  return r.rows.map((row) => JSON.parse(String(row.body)) as Report);
}

export async function kvGet(db: Db, key: string): Promise<string | null> {
  const r = await db.execute({ sql: 'SELECT value FROM kv WHERE key = ?', args: [key] });
  return r.rows[0] ? String(r.rows[0].value) : null;
}

export async function kvSet(db: Db, key: string, value: string): Promise<void> {
  await db.execute({ sql: 'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', args: [key, value] });
}
