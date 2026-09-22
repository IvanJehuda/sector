import type { Db } from '@/lib/db/client';
import { insertEvent, kvGet, kvSet } from '@/lib/db/repo';
import { addDays } from '@/lib/market/dates';
import { budgetState } from '@/lib/sectors/budget';
import type { SectorsClient } from '@/lib/sectors/client';
import { fetchNewsPage, type NewsPage } from '@/lib/sectors/endpoints';
import { fakeNewsPage } from '@/lib/sectors/fake';
import type { CreditLedger } from '@/lib/sectors/stores';
import { newsToEvent } from './news';

export const POLL_KV_KEY = 'news:last_poll_date';
export const MAX_POLL_PAGES = 3;
const DEFAULT_LOOKBACK_DAYS = 2;

export interface NewsSource {
  page(start: string, offset: number): Promise<NewsPage>;
}

export function sectorsNewsSource(c: SectorsClient): NewsSource {
  return { page: (start, offset) => fetchNewsPage(c, { start, offset }) };
}

export function fakeNewsSource(today: string): NewsSource {
  return { page: async () => fakeNewsPage(today) };
}

export interface PollResult {
  inserted: number;
  skipped: 'budget' | null;
  start: string;
}

export async function pollNews(deps: {
  db: Db;
  source: NewsSource;
  ledger: CreditLedger;
  budget: number;
  today: string;
}): Promise<PollResult> {
  const start = (await kvGet(deps.db, POLL_KV_KEY)) ?? addDays(deps.today, -DEFAULT_LOOKBACK_DAYS);
  if (budgetState(await deps.ledger.total(), deps.budget) !== 'ok') return { inserted: 0, skipped: 'budget', start };

  let inserted = 0;
  let offset = 0;
  for (let page = 0; page < MAX_POLL_PAGES; page++) {
    const res = await deps.source.page(start, offset);
    for (const article of res.articles) {
      if ((await insertEvent(deps.db, newsToEvent(article))).created) inserted++;
    }
    if (!res.hasNext || res.nextOffset === null) break;
    offset = res.nextOffset;
  }
  await kvSet(deps.db, POLL_KV_KEY, deps.today);
  return { inserted, skipped: null, start };
}
