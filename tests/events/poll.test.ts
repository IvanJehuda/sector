import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import { kvGet, listEvents } from '@/lib/db/repo';
import { MAX_POLL_PAGES, POLL_KV_KEY, pollNews, type NewsSource } from '@/lib/events/poll';
import type { NewsPage } from '@/lib/sectors/endpoints';
import { memoryLedger } from '@/lib/sectors/stores';

const TODAY = '2026-09-22';

function article(n: number) {
  return { title: `Berita ${n}`, body: 'Isi', source: `https://example.com/n${n}`, timestamp: '2026-09-22T09:00:00', symbols: [], tags: [], sub_sector: [] };
}

function pagedSource(pages: NewsPage[]) {
  return { page: vi.fn(async (_start: string, offset: number) => pages[offset / 30] ?? { articles: [], hasNext: false, nextOffset: null }) } satisfies NewsSource;
}

let db: Db;
beforeEach(async () => {
  db = createDb(':memory:');
  await migrate(db);
});

describe('pollNews', () => {
  it('inserts new articles, dedupes on re-poll and remembers the poll date', async () => {
    const source = pagedSource([{ articles: [article(1), article(2)], hasNext: false, nextOffset: null }]);
    const first = await pollNews({ db, source, ledger: memoryLedger(), budget: 1000, today: TODAY });
    expect(first).toEqual({ inserted: 2, skipped: null, start: '2026-09-20' });
    expect(await kvGet(db, POLL_KV_KEY)).toBe(TODAY);

    const second = await pollNews({ db, source, ledger: memoryLedger(), budget: 1000, today: TODAY });
    expect(second).toEqual({ inserted: 0, skipped: null, start: TODAY });
    expect(await listEvents(db)).toHaveLength(2);
  });

  it('follows pagination but stops at MAX_POLL_PAGES', async () => {
    const pages = Array.from({ length: 5 }, (_, i) => ({ articles: [article(i)], hasNext: true, nextOffset: (i + 1) * 30 }));
    const source = pagedSource(pages);
    const result = await pollNews({ db, source, ledger: memoryLedger(), budget: 1000, today: TODAY });
    expect(source.page).toHaveBeenCalledTimes(MAX_POLL_PAGES);
    expect(result.inserted).toBe(MAX_POLL_PAGES);
  });

  it('skips polling when the credit budget is at 80% or more', async () => {
    const source = pagedSource([]);
    const result = await pollNews({ db, source, ledger: memoryLedger(800), budget: 1000, today: TODAY });
    expect(result.skipped).toBe('budget');
    expect(source.page).not.toHaveBeenCalled();
  });
});
