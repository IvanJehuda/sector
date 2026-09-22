import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import {
  getEvent,
  getReport,
  insertEvent,
  kvGet,
  kvSet,
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
