const WIB_OFFSET_MS = 7 * 3_600_000;
export const MARKET_CLOSE_HOUR_WIB = 16;
const WINDOW_DAYS = 89;
const POST_EVENT_CALENDAR_DAYS = 10;

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The first weekday on or after `day`: the earliest session that can close on a weekend article. */
export function firstWeekdayOnOrAfter(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 6 ? addDays(day, 2) : weekday === 0 ? addDays(day, 1) : day;
}

/** First WIB calendar day whose trading session can react to the event. */
export function eventCalendarDate(publishedAt: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) return publishedAt;
  const hasOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(publishedAt);
  const wib = hasOffset
    ? new Date(new Date(publishedAt).getTime() + WIB_OFFSET_MS)
    : new Date(`${publishedAt.replace(' ', 'T')}Z`);
  if (Number.isNaN(wib.getTime())) throw new Error(`Invalid publishedAt: ${publishedAt}`);
  const day = wib.toISOString().slice(0, 10);
  return wib.getUTCHours() >= MARKET_CLOSE_HOUR_WIB ? addDays(day, 1) : day;
}

function lastDayOfMonth(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * 90-day fetch window around an event. The end is bucketed to the 15th or the
 * month end so nearby events share cached price data.
 */
export function priceWindow(eventDay: string, today: string): { start: string; end: string } {
  const target = addDays(eventDay, POST_EVENT_CALENDAR_DAYS);
  const bucketEnd = Number(target.slice(8, 10)) <= 15 ? `${target.slice(0, 8)}15` : lastDayOfMonth(target);
  const end = bucketEnd < today ? bucketEnd : today;
  return { start: addDays(end, -WINDOW_DAYS), end };
}

export function firstTradingDayOnOrAfter(tradingDays: string[], day: string): string | null {
  return tradingDays.find((d) => d >= day) ?? null;
}
