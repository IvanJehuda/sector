import { ANALYSIS_STALE_MS, type EventStatus, type StoredEvent } from '@/lib/domain';

/** The event page stops polling after this long without a report. */
export const POLL_TIMEOUT_MS = 300_000;

/** True while another analysis of this event is running (status 'analyzing' and not stale). */
export function isAnalysisInFlight(e: Pick<StoredEvent, 'status' | 'statusUpdatedAt'>, now: Date = new Date()): boolean {
  if (e.status !== 'analyzing' || !e.statusUpdatedAt) return false;
  const updated = Date.parse(e.statusUpdatedAt);
  return !Number.isNaN(updated) && now.getTime() - updated < ANALYSIS_STALE_MS;
}

export function shouldKeepPolling(p: { hasReport: boolean; status: EventStatus; elapsedMs: number }): 'poll' | 'stop' | 'timeout' {
  if (p.hasReport || p.status === 'failed') return 'stop';
  return p.elapsedMs >= POLL_TIMEOUT_MS ? 'timeout' : 'poll';
}
