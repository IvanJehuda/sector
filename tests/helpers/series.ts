import type { PricePoint } from '@/lib/domain';

/** n consecutive Mon–Fri dates starting at `start` (inclusive if it is a weekday). */
export function weekdays(start: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  while (out.length < n) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Price series whose i-th return (i ≥ 1) equals rets[i]. rets[0] is ignored. */
export function pricesFromReturns(dates: string[], rets: number[]): PricePoint[] {
  let p = 1000;
  return dates.map((date, i) => {
    if (i > 0) p = p * (1 + rets[i]);
    return { date, close: p };
  });
}
