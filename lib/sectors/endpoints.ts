import { normalizeSymbol, type Company, type FlowPoint, type Mover, type PricePoint } from '@/lib/domain';
import type { SectorsClient } from './client';
import {
  CompanyOverviewSchema,
  DailySchema,
  ForeignFlowSchema,
  IndexDailySchema,
  NewsPageSchema,
  ScreenerSchema,
  TopChangesSchema,
  type NewsArticle,
} from './schemas';

const DAY_SECONDS = 86_400;
const WEEK_SECONDS = 7 * DAY_SECONDS;
const UNIVERSE_MAX_PAGES = 10;

export const UNIVERSE_WHERE = "market_cap > 0 and sub_sector != ''";
export const UNIVERSE_PAGE_SIZE = 200;

/** Price windows that ended before today never change, so cache them forever. */
export function priceTtl(end: string, today: string): number | null {
  return end < today ? null : 3600;
}

const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);
const quote = (v: string) => `'${v.replace(/'/g, '')}'`;

export const groupWhere = (group: string) => `affiliates in [${quote(group)}]`;
export const indexWhere = (code: string) => `indices in [${quote(code.toUpperCase())}]`;

export async function fetchDaily(c: SectorsClient, symbol: string, start: string, end: string, today: string): Promise<PricePoint[]> {
  const rows = await c.get(`/v2/daily/${normalizeSymbol(symbol)}/`, { start, end }, DailySchema, {
    cost: 1,
    ttlSeconds: priceTtl(end, today),
  });
  return rows.map((r) => ({ date: r.date, close: r.close })).sort(byDate);
}

export async function fetchIndexDaily(c: SectorsClient, code: string, start: string, end: string, today: string): Promise<PricePoint[]> {
  const rows = await c.get(`/v2/index-daily/${code.toLowerCase()}/`, { start, end }, IndexDailySchema, {
    cost: 1,
    ttlSeconds: priceTtl(end, today),
  });
  return rows.map((r) => ({ date: r.date, close: r.price })).sort(byDate);
}

export async function fetchForeignFlow(c: SectorsClient, symbol: string, start: string, end: string, today: string): Promise<FlowPoint[]> {
  const res = await c.get(`/v2/foreign-flow/${normalizeSymbol(symbol)}/`, { start, end }, ForeignFlowSchema, {
    cost: 1,
    ttlSeconds: priceTtl(end, today),
  });
  return res.data.map((d) => ({ date: d.date, netForeignInflow: d.net_foreign_inflow })).sort(byDate);
}

export async function fetchUniverse(c: SectorsClient): Promise<Company[]> {
  const out: Company[] = [];
  let offset = 0;
  for (let page = 0; page < UNIVERSE_MAX_PAGES; page++) {
    const res = await c.get(
      '/v2/companies/',
      { where: UNIVERSE_WHERE, order_by: '-market_cap', limit: UNIVERSE_PAGE_SIZE, offset, include_query_values: true },
      ScreenerSchema,
      { cost: 1, ttlSeconds: WEEK_SECONDS },
    );
    for (const r of res.results) {
      const qv = r.query_values ?? {};
      out.push({
        symbol: normalizeSymbol(r.symbol),
        name: r.company_name,
        subSector: typeof qv.sub_sector === 'string' ? qv.sub_sector : null,
        marketCap: typeof qv.market_cap === 'number' ? qv.market_cap : null,
      });
    }
    if (!res.pagination.has_next || res.pagination.next_offset === null) break;
    offset = res.pagination.next_offset;
  }
  return out;
}

export async function fetchScreenerSymbols(c: SectorsClient, where: string): Promise<string[]> {
  const res = await c.get('/v2/companies/', { where, order_by: '-market_cap', limit: 50 }, ScreenerSchema, {
    cost: 1,
    ttlSeconds: WEEK_SECONDS,
  });
  return res.results.map((r) => normalizeSymbol(r.symbol));
}

export async function fetchAffiliates(c: SectorsClient, symbol: string): Promise<string[]> {
  const res = await c.get(`/v2/company/report/${normalizeSymbol(symbol)}/`, { sections: 'overview' }, CompanyOverviewSchema, {
    cost: 1,
    ttlSeconds: WEEK_SECONDS,
  });
  return res.overview.affiliates ?? [];
}

export async function fetchTopLosers1d(c: SectorsClient): Promise<Mover[]> {
  const res = await c.get(
    '/v2/companies/top-changes/',
    { classifications: 'top_losers', periods: '1d', n_stock: 10 },
    TopChangesSchema,
    { cost: 1, ttlSeconds: 3600 },
  );
  return (res.top_losers?.['1d'] ?? []).map((m) => ({
    symbol: normalizeSymbol(m.symbol),
    name: m.name,
    priceChange: m.price_change,
    date: m.latest_close_date,
  }));
}

export interface NewsPage {
  articles: NewsArticle[];
  hasNext: boolean;
  nextOffset: number | null;
}

export async function fetchNewsPage(c: SectorsClient, q: { start: string; offset: number; tags?: string }): Promise<NewsPage> {
  const res = await c.get('/v2/news/', { start: q.start, limit: 30, offset: q.offset, tags: q.tags }, NewsPageSchema, {
    cost: 1,
    ttlSeconds: 1800,
  });
  return { articles: res.results, hasNext: res.pagination.has_next, nextOffset: res.pagination.next_offset };
}
