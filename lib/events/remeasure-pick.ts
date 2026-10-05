import { eventCalendarDate, firstWeekdayOnOrAfter } from '@/lib/market/dates';

export interface RemeasureCandidate {
  eventId: string;
  publishedAt: string;
  /** WIB date of the last re-analysis attempt, or null when never retried. */
  lastAttempt: string | null;
}

/**
 * The hypothesis report to analyse again: its first session after the news has closed before `today`,
 * and it was not already retried today. Newest news first, since that is what the homepage shows.
 */
export function pickRemeasure(candidates: RemeasureCandidate[], today: string): string | null {
  let best: { eventId: string; day: string } | null = null;
  for (const c of candidates) {
    if (c.lastAttempt === today) continue;
    let day: string;
    try {
      day = eventCalendarDate(c.publishedAt);
    } catch {
      continue;
    }
    if (firstWeekdayOnOrAfter(day) >= today) continue;
    if (!best || day > best.day) best = { eventId: c.eventId, day };
  }
  return best?.eventId ?? null;
}
