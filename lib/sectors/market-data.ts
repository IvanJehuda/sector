import { todayWib, type MarketData } from '@/lib/domain';
import type { SectorsClient } from './client';
import {
  fetchAffiliates,
  fetchDaily,
  fetchForeignFlow,
  fetchIndexDaily,
  fetchScreenerSymbols,
  fetchTopLosers1d,
  fetchUniverse,
  groupWhere,
  indexWhere,
} from './endpoints';

export function createSectorsMarketData(c: SectorsClient, today: () => string = () => todayWib()): MarketData {
  return {
    today,
    universe: () => fetchUniverse(c),
    daily: (symbol, start, end) => fetchDaily(c, symbol, start, end, today()),
    ihsg: (start, end) => fetchIndexDaily(c, 'ihsg', start, end, today()),
    foreignFlow: (symbol, start, end) => fetchForeignFlow(c, symbol, start, end, today()),
    affiliates: (symbol) => fetchAffiliates(c, symbol),
    groupMembers: (group) => fetchScreenerSymbols(c, groupWhere(group)),
    indexMembers: (code) => fetchScreenerSymbols(c, indexWhere(code)),
    topLosers1d: () => fetchTopLosers1d(c),
  };
}
