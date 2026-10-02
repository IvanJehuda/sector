import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import {
  ANALYSIS_STALE_MS,
  claimEventForAnalysis,
  countRecentAnalyses,
  getEvent,
  getReport,
  insertEvent,
  kvGet,
  kvSet,
  listDoneEvents,
  listEvents,
  listRetrospectiveReports,
  saveReport,
  setEventStatus,
} from '@/lib/db/repo';
import type { EventInput } from '@/lib/domain';
import { makeReport } from '../helpers/factories';

const input: EventInput = {
  source: 'manual',
  url: 'https://example.com/berita-a',
  title: 'Judul berita',
  body: 'Isi berita',
  publishedAt: '2026-09-01T10:00:00',
  symbols: ['BBRI'],
  tags: ['Politics & Regulation'],
  subSectors: ['Banks'],
};

let db: Db;
beforeEach(async () => {
  db = createDb(':memory:');
  await migrate(db);
});

describe('events', () => {
  it('inserts and reads back an event with status new', async () => {
    const { event, created } = await insertEvent(db, input);
    expect(created).toBe(true);
    const loaded = await getEvent(db, event.id);
    expect(loaded).toMatchObject({ ...input, status: 'new', statusMessage: null });
  });

  it('dedupes by url', async () => {
    const first = await insertEvent(db, input);
    const second = await insertEvent(db, { ...input, title: 'Lain' });
    expect(second.created).toBe(false);
    expect(second.event.id).toBe(first.event.id);
  });

  it('allows many events without url', async () => {
    await insertEvent(db, { ...input, url: null });
    await insertEvent(db, { ...input, url: null });
    expect(await listEvents(db)).toHaveLength(2);
  });

  it('updates status and message', async () => {
    const { event } = await insertEvent(db, input);
    await setEventStatus(db, event.id, 'failed', 'Gagal');
    expect(await getEvent(db, event.id)).toMatchObject({ status: 'failed', statusMessage: 'Gagal' });
  });
});

describe('insertEvent concurrency', () => {
  it('inserting the same url concurrently yields one created event and no throw', async () => {
    const results = await Promise.all([insertEvent(db, input), insertEvent(db, input), insertEvent(db, input)]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.event.id)).size).toBe(1);
    expect(await listEvents(db)).toHaveLength(1);
  });
});

describe('status timestamps', () => {
  it('insertEvent and setEventStatus set statusUpdatedAt', async () => {
    const { event } = await insertEvent(db, input);
    expect(event.statusUpdatedAt).not.toBeNull();
    await db.execute({ sql: "UPDATE events SET status_updated_at = '2000-01-01T00:00:00.000Z' WHERE id = ?", args: [event.id] });
    await setEventStatus(db, event.id, 'analyzing', 'x');
    const loaded = await getEvent(db, event.id);
    expect(loaded?.statusUpdatedAt && loaded.statusUpdatedAt > '2000-01-01T00:00:00.000Z').toBe(true);
  });
});

describe('claimEventForAnalysis', () => {
  const now = new Date('2026-09-22T10:00:00.000Z');
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - ANALYSIS_STALE_MS).toISOString();

  async function withStatus(status: string, updatedAt: string): Promise<string> {
    const { event } = await insertEvent(db, { ...input, url: null });
    await db.execute({
      sql: 'UPDATE events SET status = ?, status_updated_at = ? WHERE id = ?',
      args: [status, updatedAt, event.id],
    });
    return event.id;
  }

  it('uses a 3 minute stale window', () => {
    expect(ANALYSIS_STALE_MS).toBe(180_000);
  });

  it('claims a new event', async () => {
    const { event } = await insertEvent(db, input);
    expect(await claimEventForAnalysis(db, event.id, nowIso, staleBefore)).toBe(true);
    expect(await getEvent(db, event.id)).toMatchObject({
      status: 'analyzing',
      statusMessage: 'Memulai analisis…',
      statusUpdatedAt: nowIso,
    });
  });

  it('refuses an event that is freshly analyzing', async () => {
    const id = await withStatus('analyzing', '2026-09-22T09:59:00.000Z');
    expect(await claimEventForAnalysis(db, id, nowIso, staleBefore)).toBe(false);
  });

  it('re-claims a stale analyzing event', async () => {
    const id = await withStatus('analyzing', '2026-09-22T09:50:00.000Z');
    expect(await claimEventForAnalysis(db, id, nowIso, staleBefore)).toBe(true);
  });

  it('claims a failed event', async () => {
    const id = await withStatus('failed', '2026-09-22T09:59:30.000Z');
    expect(await claimEventForAnalysis(db, id, nowIso, staleBefore)).toBe(true);
  });

  it('only one of two concurrent claims wins', async () => {
    const { event } = await insertEvent(db, input);
    const results = await Promise.all([
      claimEventForAnalysis(db, event.id, nowIso, staleBefore),
      claimEventForAnalysis(db, event.id, nowIso, staleBefore),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('returns false for an unknown id', async () => {
    expect(await claimEventForAnalysis(db, 'nope', nowIso, staleBefore)).toBe(false);
  });
});

describe('countRecentAnalyses', () => {
  it('counts reports created since the cutoff plus events currently analyzing', async () => {
    const since = '2026-09-21T10:00:00.000Z';
    await saveReport(db, makeReport({ eventId: 'old', createdAt: '2026-09-20T10:00:00.000Z' }));
    await saveReport(db, makeReport({ eventId: 'r1', createdAt: '2026-09-22T08:00:00.000Z' }));
    await saveReport(db, makeReport({ eventId: 'r2', createdAt: '2026-09-21T12:00:00.000Z' }));
    const a = await insertEvent(db, { ...input, url: null });
    await setEventStatus(db, a.event.id, 'analyzing', 'x');
    const b = await insertEvent(db, { ...input, url: null });
    await setEventStatus(db, b.event.id, 'failed', 'x');
    expect(await countRecentAnalyses(db, since)).toBe(3);
  });

  it('is zero on an empty database', async () => {
    expect(await countRecentAnalyses(db, '2026-09-21T10:00:00.000Z')).toBe(0);
  });
});

describe('migrate', () => {
  it('adds status_updated_at to a pre-existing events table without it', async () => {
    const legacy = createDb(':memory:');
    await legacy.execute(`CREATE TABLE events (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, url TEXT UNIQUE, title TEXT NOT NULL, body TEXT NOT NULL,
      published_at TEXT NOT NULL, symbols TEXT NOT NULL, tags TEXT NOT NULL, sub_sectors TEXT NOT NULL,
      status TEXT NOT NULL, status_message TEXT, created_at TEXT NOT NULL)`);
    await legacy.execute(`INSERT INTO events VALUES ('e1', 'manual', NULL, 't', 'b', '2026-09-01', '[]', '[]', '[]', 'done', NULL, '2026-09-01T00:00:00.000Z')`);
    await migrate(legacy);
    await migrate(legacy); // idempotent
    const cols = (await legacy.execute('PRAGMA table_info(events)')).rows.map((r) => String(r.name));
    expect(cols).toContain('status_updated_at');
    expect(await getEvent(legacy, 'e1')).toMatchObject({ id: 'e1', statusUpdatedAt: null });
  });
});

describe('reports', () => {
  it('saves, reads and lists only retrospective reports', async () => {
    await saveReport(db, makeReport({ eventId: 'a' }));
    await saveReport(db, makeReport({ eventId: 'b', mode: 'prospective' }));
    expect((await getReport(db, 'a'))?.eventId).toBe('a');
    expect(await getReport(db, 'zzz')).toBeNull();
    const retro = await listRetrospectiveReports(db);
    expect(retro.map((r) => r.eventId)).toEqual(['a']);
  });
});

describe('kv', () => {
  it('round-trips values', async () => {
    expect(await kvGet(db, 'k')).toBeNull();
    await kvSet(db, 'k', 'v1');
    await kvSet(db, 'k', 'v2');
    expect(await kvGet(db, 'k')).toBe('v2');
  });
});

describe('listDoneEvents', () => {
  const add = (n: number, day: string) =>
    insertEvent(db, { ...input, url: `https://example.com/done-${n}`, publishedAt: `2026-09-${day}T10:00:00` });

  it('returns only finished events, newest first, up to the limit', async () => {
    const a = (await add(1, '01')).event;
    const b = (await add(2, '03')).event;
    const c = (await add(3, '02')).event;
    await add(4, '05'); // stays 'new'
    const failed = (await add(5, '06')).event;
    const analyzing = (await add(6, '07')).event;
    for (const e of [a, b, c]) await setEventStatus(db, e.id, 'done');
    await setEventStatus(db, failed.id, 'failed', 'Gagal');
    await setEventStatus(db, analyzing.id, 'analyzing');

    expect((await listDoneEvents(db)).map((e) => e.id)).toEqual([b.id, c.id, a.id]);
    expect((await listDoneEvents(db, 2)).map((e) => e.id)).toEqual([b.id, c.id]);
  });

  it('defaults to six', async () => {
    for (let i = 10; i < 18; i++) {
      const { event } = await add(i, String(i));
      await setEventStatus(db, event.id, 'done');
    }
    expect(await listDoneEvents(db)).toHaveLength(6);
  });
});
