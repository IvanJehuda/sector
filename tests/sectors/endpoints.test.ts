import { describe, expect, it } from 'vitest';
import {
  fetchAffiliates,
  fetchDaily,
  fetchForeignFlow,
  fetchIndexDaily,
  fetchNewsPage,
  fetchTopLosers1d,
  fetchUniverse,
  indexWhere,
  priceTtl,
  UNIVERSE_PAGE_SIZE,
  UNIVERSE_WHERE,
} from '@/lib/sectors/endpoints';
import { createSectorsMarketData } from '@/lib/sectors/market-data';
import { loadSample, putFixture, tempFixtureClient } from '../helpers/fixtures';

const TODAY = '2026-09-22';

describe('priceTtl', () => {
  it('is permanent for windows that ended before today', () => {
    expect(priceTtl('2026-09-21', TODAY)).toBeNull();
    expect(priceTtl('2026-09-22', TODAY)).toBe(3600);
  });
});

describe('endpoints', () => {
  it('fetchDaily maps and sorts ascending', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/daily/BBCA/', { start: '2025-05-01', end: '2025-05-14' }, [
      { symbol: 'BBCA.JK', date: '2025-05-05', close: 9000 },
      { symbol: 'BBCA.JK', date: '2025-05-02', close: 8975 },
    ]);
    expect(await fetchDaily(client, 'bbca.jk', '2025-05-01', '2025-05-14', TODAY)).toEqual([
      { date: '2025-05-02', close: 8975 },
      { date: '2025-05-05', close: 9000 },
    ]);
  });

  it('fetchIndexDaily maps price to close', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/index-daily/ihsg/', { start: '2025-05-01', end: '2025-05-14' }, [
      { index_code: 'IHSG', date: '2025-05-05', price: 6800.5 },
    ]);
    expect(await fetchIndexDaily(client, 'IHSG', '2025-05-01', '2025-05-14', TODAY)).toEqual([
      { date: '2025-05-05', close: 6800.5 },
    ]);
  });

  it('fetchForeignFlow maps net inflow', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/foreign-flow/BBCA/', { start: '2025-05-01', end: '2025-05-05' }, await loadSample('foreign-flow.json'));
    expect(await fetchForeignFlow(client, 'BBCA', '2025-05-01', '2025-05-05', TODAY)).toEqual([
      { date: '2025-05-02', netForeignInflow: 146476750000 },
    ]);
  });

  it('fetchUniverse reads sub_sector and market_cap from query_values', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(
      dir,
      '/v2/companies/',
      { where: UNIVERSE_WHERE, order_by: '-market_cap', limit: UNIVERSE_PAGE_SIZE, offset: 0, include_query_values: true },
      await loadSample('screener.json'),
    );
    expect(await fetchUniverse(client)).toEqual([
      { symbol: 'BBCA', name: 'PT Bank Central Asia Tbk.', subSector: 'Banks', marketCap: 753611199412500 },
    ]);
  });

  it('fetchAffiliates returns overview affiliates', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/company/report/BBCA/', { sections: 'overview' }, await loadSample('company-report-overview.json'));
    expect(await fetchAffiliates(client, 'BBCA')).toEqual(['Djarum', 'Hartono']);
  });

  it('fetchTopLosers1d normalizes symbols', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/companies/top-changes/', { classifications: 'top_losers', periods: '1d', n_stock: 10 }, await loadSample('top-changes.json'));
    expect(await fetchTopLosers1d(client)).toEqual([
      { symbol: 'BKSL', name: 'Sentul City Tbk', priceChange: -0.0895522388059701, date: '2026-07-08' },
    ]);
  });

  it('fetchNewsPage returns articles and pagination', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/news/', { start: '2026-07-01', limit: 30, offset: 0 }, await loadSample('news.json'));
    const page = await fetchNewsPage(client, { start: '2026-07-01', offset: 0 });
    expect(page.articles).toHaveLength(1);
    expect(page.hasNext).toBe(true);
    expect(page.nextOffset).toBe(30);
  });

  it('MarketData.indexMembers queries the screener by index', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/companies/', { where: indexWhere('IDXBUMN20'), order_by: '-market_cap', limit: 50 }, await loadSample('screener.json'));
    const market = createSectorsMarketData(client, () => TODAY);
    expect(await market.indexMembers('idxbumn20')).toEqual(['BBCA']);
  });
});
