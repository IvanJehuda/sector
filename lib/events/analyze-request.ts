import { z } from 'zod';

/** True for a real calendar day written as YYYY-MM-DD (rejects e.g. 2026-02-30). */
export function isCalendarDay(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** Body of POST /api/analyze. */
export const AnalyzeBodySchema = z.object({
  url: z.string().url().refine(isHttpUrl).optional(),
  text: z.string().optional(),
  title: z.string().optional(),
  date: z.string().refine(isCalendarDay).optional(),
  eventId: z.string().optional(),
});
