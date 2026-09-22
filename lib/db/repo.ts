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
    statusUpdatedAt: r.status_updated_at === null || r.status_updated_at === undefined ? null : String(r.status_updated_at),
  };
}

export { ANALYSIS_STALE_MS } from '@/lib/domain';

export async function getEvent(db: Db, id: string): Promise<StoredEvent | null> {
  const r = await db.execute({ sql: 'SELECT * FROM events WHERE id = ?', args: [id] });
  return r.rows[0] ? rowToEvent(r.rows[0]) : null;
}

export async function insertEvent(
  db: Db,
  input: EventInput,
): Promise<{ event: StoredEvent; created: boolean }> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const r = await db.execute({
    sql: `INSERT INTO events (id, source, url, title, body, published_at, symbols, tags, sub_sectors, status, status_message, created_at, status_updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', NULL, ?, ?)
          ON CONFLICT(url) DO NOTHING`,
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
      now,
      now,
    ],
  });
  const created = r.rowsAffected === 1;
  const found = created
    ? await db.execute({ sql: 'SELECT * FROM events WHERE id = ?', args: [id] })
    : await db.execute({ sql: 'SELECT * FROM events WHERE url = ?', args: [input.url] });
  if (!found.rows[0]) throw new Error('insertEvent: row missing after insert');
  return { event: rowToEvent(found.rows[0]), created };
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
  await db.execute({
    sql: 'UPDATE events SET status = ?, status_message = ?, status_updated_at = ? WHERE id = ?',
    args: [status, message, new Date().toISOString(), id],
  });
}

/**
 * Atomically marks an event as 'analyzing' unless another analysis is already in flight
 * (status 'analyzing' updated after `staleBeforeIso`). Returns true when this caller won the claim.
 */
export async function claimEventForAnalysis(db: Db, id: string, nowIso: string, staleBeforeIso: string): Promise<boolean> {
  const r = await db.execute({
    sql: `UPDATE events SET status = 'analyzing', status_message = 'Memulai analisis…', status_updated_at = ?
          WHERE id = ? AND NOT (status = 'analyzing' AND status_updated_at IS NOT NULL AND status_updated_at > ?)`,
    args: [nowIso, id, staleBeforeIso],
  });
  return r.rowsAffected === 1;
}

/** Reports created since `sinceIso` plus analyses started since then that are still running. */
export async function countRecentAnalyses(db: Db, sinceIso: string): Promise<number> {
  const r = await db.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM reports WHERE created_at >= ?) +
            (SELECT COUNT(*) FROM events WHERE status = 'analyzing' AND (status_updated_at IS NULL OR status_updated_at >= ?)) AS n`,
    args: [sinceIso, sinceIso],
  });
  return Number(r.rows[0]?.n ?? 0);
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
