import { describe, expect, it } from 'vitest';
import {
  dailyReturns,
  isMarketWide,
  marketReturnOn,
  measureReaction,
  stdev,
  sumFlowBetween,
} from '@/lib/market/reaction';
import { pricesFromReturns, weekdays } from '../helpers/series';

// 2026-01-05 is a Monday; index 45 is Monday 2026-03-09.
const DATES = weekdays('2026-01-05', 60);
const marketRets = DATES.map((_, i) => 0.002 * (i % 2 === 0 ? 1 : -1));
const noise = (i: number) => 0.004 * (i % 3 === 0 ? 1 : -0.5);
const market = pricesFromReturns(DATES, marketRets);

function stockWithShock(shock: number) {
  return pricesFromReturns(
    DATES,
    DATES.map((_, i) => marketRets[i] + noise(i) + (i === 45 ? shock : 0)),
  );
}

describe('helpers', () => {
  it('computes simple returns and sample stdev', () => {
    expect(dailyReturns([{ date: 'a', close: 100 }, { date: 'b', close: 110 }])).toEqual([{ date: 'b', ret: 0.10000000000000009 }]);
    expect(stdev([1, 2, 3, 4])).toBeCloseTo(1.2909944, 6);
  });
});

describe('measureReaction', () => {
  it('detects a significant abnormal drop at t0', () => {
    expect(DATES[45]).toBe('2026-03-09');
    const r = measureReaction(stockWithShock(-0.08), market, '2026-03-09');
    expect(r).not.toBeNull();
    expect(r!.t0).toBe('2026-03-09');
    expect(r!.days).toBe(6);
    expect(r!.tEnd).toBe(DATES[50]);
    expect(r!.car).toBeLessThan(-0.07);
    expect(r!.significant).toBe(true);
    expect(r!.zScore).toBeLessThan(-2);
  });

  it('reports no significant reaction without a shock', () => {
    const r = measureReaction(stockWithShock(0), market, '2026-03-09');
    expect(r!.significant).toBe(false);
    expect(Math.abs(r!.car)).toBeLessThan(0.01);
  });

  it('maps a weekend event to the next trading day', () => {
    expect(measureReaction(stockWithShock(-0.08), market, '2026-03-07')!.t0).toBe('2026-03-09');
  });

  it('returns null when the estimation window is too short', () => {
    expect(measureReaction(stockWithShock(0), market, DATES[10])).toBeNull();
  });

  it('returns null when the event is after the last trading day', () => {
    expect(measureReaction(stockWithShock(0), market, '2026-12-31')).toBeNull();
  });
});

describe('market helpers', () => {
  it('reads the IHSG return of a day and flags market-wide moves', () => {
    expect(marketReturnOn(market, DATES[1])).toBeCloseTo(-0.002, 10);
    expect(marketReturnOn(market, '1999-01-01')).toBeNull();
    expect(isMarketWide(-0.025)).toBe(true);
    expect(isMarketWide(0.01)).toBe(false);
  });

  it('sums foreign flow inside a date range', () => {
    const flow = [
      { date: '2026-03-06', netForeignInflow: 100 },
      { date: '2026-03-09', netForeignInflow: -300 },
      { date: '2026-03-10', netForeignInflow: 50 },
    ];
    expect(sumFlowBetween(flow, '2026-03-09', '2026-03-10')).toBe(-250);
  });
});
