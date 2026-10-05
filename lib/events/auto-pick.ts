import type { StoredEvent } from '@/lib/domain';
import { eventCalendarDate, firstWeekdayOnOrAfter } from '@/lib/market/dates';

/** Sectors news tags that mark policy or regulation news, the app's core use case (README, "Tag berita"). */
export const POLICY_TAG_SLUGS = [
  'politics-regulation',
  'government-policy',
  'ministry',
  'ojk',
  'central-bank',
  'interest-rate',
  'tariff-vat',
  'subsidies-incentives',
] as const;

const POLICY = new Set<string>(POLICY_TAG_SLUGS);

/** "Politics & Regulation" → "politics-regulation", the form Sectors uses in /v2/tags/. */
export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The article's trading-calendar day, or null when its date cannot be read. */
function eventDay(publishedAt: string): string | null {
  try {
    return eventCalendarDate(publishedAt);
  } catch {
    return null;
  }
}

/**
 * The newest unanalysed policy article whose event day is before `today` (WIB), or null.
 * Today's articles wait a day: until a trading day has closed, the report would have no price reaction,
 * and reports are never re-run.
 */
export function pickAutoAnalysis(events: StoredEvent[], today: string): StoredEvent | null {
  const candidates = events
    .filter((e) => e.status === 'new' && e.tags.some((t) => POLICY.has(tagSlug(t))))
    .map((e) => ({ e, day: eventDay(e.publishedAt) }))
    .filter((c): c is { e: StoredEvent; day: string } => c.day !== null && firstWeekdayOnOrAfter(c.day) < today);
  candidates.sort((a, b) => b.day.localeCompare(a.day));
  return candidates[0]?.e ?? null;
}
