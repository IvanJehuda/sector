import { describe, expect, it } from 'vitest';
import { dailyReturns } from '@/lib/market/reaction';
import { createFakeMarketData, weekdaysBetween } from '@/lib/sectors/fake';

describe('fake market data', () => {
  const market = createFakeMarketData({ shockDay: '2026-03-09', today: '2026-03-20' });

  it('only produces weekdays up to today', async () => {
    const ihsg = await market.ihsg('2026-03-01', '2026-03-31');
    expect(ihsg[0].date).toBe('2026-03-02');
    expect(ihsg[ihsg.length - 1].date).toBe('2026-03-20');
    expect(weekdaysBetween('2026-03-07', '2026-03-08')).toEqual([]);
  });

  it('applies the configured shock to BBRI', async () => {
    const r = dailyReturns(await market.daily('BBRI', '2026-02-01', '2026-03-20')).find((x) => x.date === '2026-03-09');
    expect(r!.ret).toBeLessThan(-0.06);
  });

  it('is deterministic', async () => {
    expect(await market.daily('TLKM', '2026-02-01', '2026-03-20')).toEqual(await market.daily('TLKM', '2026-02-01', '2026-03-20'));
  });
});
