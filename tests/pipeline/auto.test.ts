import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import { getEvent, insertEvent, kvGet, saveReport, setEventStatus } from '@/lib/db/repo';
import type { EventInput } from '@/lib/domain';
import { claimAutoAnalysis, remeasureKey } from '@/lib/pipeline/auto';
import { memoryLedger } from '@/lib/sectors/stores';
import { makeReport } from '../helpers/factories';

const TODAY = '2026-10-05';
const NOW = new Date('2026-10-05T01:00:00.000Z'); // 08:00 WIB, the first scheduled poll
const OPEN = { dailyLimit: 5, publicRatio: 0.3 };

const policyNews: EventInput = {
  source: 'feed',
  url: 'https://example.com/ojk',
  title: 'OJK terbitkan aturan baru',
  body: 'Isi berita',
  publishedAt: '2026-10-02T09:00:00',
  symbols: [],
  tags: ['OJK'],
  subSectors: [],
};

let db: Db;
beforeEach(async () => {
  db = createDb(':memory:');
  await migrate(db);
});

const claim = (overrides: Partial<Parameters<typeof claimAutoAnalysis>[0]> = {}) =>
  claimAutoAnalysis({ db, ledger: memoryLedger(), budget: 481, config: OPEN, today: TODAY, now: NOW, ...overrides });

describe('claimAutoAnalysis', () => {
  it('claims the picked policy article and hands back its id', async () => {
    const { event } = await insertEvent(db, policyNews);
    expect(await claim()).toEqual({ eventId: event.id });
    expect((await getEvent(db, event.id))?.status).toBe('analyzing');
  });

  it('does nothing when no article qualifies', async () => {
    await insertEvent(db, { ...policyNews, tags: ['Dividend Announcement'] });
    expect(await claim()).toEqual({ skipped: 'no-candidate' });
  });

  it('respects the daily analysis cap shared with visitors', async () => {
    const { event } = await insertEvent(db, policyNews);
    expect(await claim({ config: { ...OPEN, dailyLimit: 0 } })).toEqual({ skipped: 'blocked' });
    expect((await getEvent(db, event.id))?.status).toBe('new');
  });

  it('stops once spending reaches the public share of the budget', async () => {
    const { event } = await insertEvent(db, policyNews);
    expect(await claim({ ledger: memoryLedger(145) })).toEqual({ skipped: 'blocked' });
    expect((await getEvent(db, event.id))?.status).toBe('new');
  });

  it('never claims the same article twice', async () => {
    await insertEvent(db, policyNews);
    await claim();
    expect(await claim()).toEqual({ skipped: 'no-candidate' });
  });

  /** A finished hypothesis report on Thursday's news: Thursday's session has closed by Monday. */
  async function hypothesisReport() {
    const { event } = await insertEvent(db, { ...policyNews, url: 'https://example.com/hipotesis', publishedAt: '2026-10-01T09:00:00' });
    await saveReport(db, makeReport({ eventId: event.id, mode: 'prospective', market: null }));
    await setEventStatus(db, event.id, 'done');
    return event;
  }

  it('re-measures a hypothesis report before analysing new articles', async () => {
    const hyp = await hypothesisReport();
    await insertEvent(db, policyNews);

    expect(await claim()).toEqual({ eventId: hyp.id, refresh: true });
    expect((await getEvent(db, hyp.id))?.status).toBe('analyzing');
    expect(await kvGet(db, remeasureKey(hyp.id))).toBe(TODAY);
  });

  it('retries each hypothesis report at most once a day, then moves on to new articles', async () => {
    const hyp = await hypothesisReport();
    const { event: fresh } = await insertEvent(db, policyNews);
    await claim();
    await setEventStatus(db, hyp.id, 'done'); // the re-run ended, still a hypothesis (e.g. an exchange holiday)

    expect(await claim()).toEqual({ eventId: fresh.id });
  });

  it('picks up a re-analysis that was killed mid-run on a later day', async () => {
    const hyp = await hypothesisReport();
    await setEventStatus(db, hyp.id, 'analyzing'); // killed at the time limit: no catch ran
    await db.execute({ sql: 'UPDATE events SET status_updated_at = ? WHERE id = ?', args: ['2026-10-02T01:00:00.000Z', hyp.id] });

    expect(await claim()).toEqual({ eventId: hyp.id, refresh: true });
  });

  it('keeps the retry for later when the guard blocks the run', async () => {
    const hyp = await hypothesisReport();

    expect(await claim({ config: { ...OPEN, dailyLimit: 0 } })).toEqual({ skipped: 'blocked' });
    expect(await kvGet(db, remeasureKey(hyp.id))).toBeNull();
    expect((await getEvent(db, hyp.id))?.status).toBe('done');
  });
});
