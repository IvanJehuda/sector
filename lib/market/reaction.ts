import type { FlowPoint, PricePoint, Reaction } from '@/lib/domain';

export const ESTIMATION_MAX = 40;
export const ESTIMATION_MIN = 20;
export const POST_DAYS = 5;
export const Z_THRESHOLD = 2;
export const MARKET_WIDE_THRESHOLD = 0.02;

export interface DailyReturn {
  date: string;
  ret: number;
}

export function dailyReturns(points: PricePoint[]): DailyReturn[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const out: DailyReturn[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].close;
    if (prev > 0) out.push({ date: sorted[i].date, ret: sorted[i].close / prev - 1 });
  }
  return out;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

export function measureReaction(stock: PricePoint[], market: PricePoint[], eventDay: string): Reaction | null {
  const marketByDate = new Map(dailyReturns(market).map((r) => [r.date, r.ret]));
  const aligned = dailyReturns(stock).flatMap((r) => {
    const rm = marketByDate.get(r.date);
    return rm === undefined ? [] : [{ date: r.date, ar: r.ret - rm, rm }];
  });
  const t0Idx = aligned.findIndex((r) => r.date >= eventDay);
  if (t0Idx < 0) return null;

  const estimation = aligned.slice(Math.max(0, t0Idx - 1 - ESTIMATION_MAX), Math.max(0, t0Idx - 1));
  if (estimation.length < ESTIMATION_MIN) return null;

  const window = aligned.slice(t0Idx, t0Idx + POST_DAYS + 1);
  const sigma = stdev(estimation.map((r) => r.ar));
  const car = window.reduce((s, r) => s + r.ar, 0);
  const marketReturn = window.reduce((p, r) => p * (1 + r.rm), 1) - 1;
  const zScore = sigma > 0 ? car / (sigma * Math.sqrt(window.length)) : 0;
  return {
    t0: window[0].date,
    tEnd: window[window.length - 1].date,
    days: window.length,
    car,
    marketReturn,
    sigma,
    zScore,
    significant: Math.abs(zScore) >= Z_THRESHOLD,
  };
}

export function marketReturnOn(market: PricePoint[], day: string): number | null {
  return dailyReturns(market).find((r) => r.date === day)?.ret ?? null;
}

export function isMarketWide(ihsgReturnT0: number): boolean {
  return Math.abs(ihsgReturnT0) >= MARKET_WIDE_THRESHOLD;
}

export function sumFlowBetween(flow: FlowPoint[], from: string, to: string): number {
  return flow.filter((f) => f.date >= from && f.date <= to).reduce((s, f) => s + f.netForeignInflow, 0);
}
