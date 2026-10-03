import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import { getEvent, insertEvent } from '@/lib/db/repo';
import type { EventInput } from '@/lib/domain';
import { claimAutoAnalysis } from '@/lib/pipeline/auto';
import { memoryLedger } from '@/lib/sectors/stores';

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
});
