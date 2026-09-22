import { describe, expect, it } from 'vitest';
import { isAnalysisInFlight, POLL_TIMEOUT_MS, shouldKeepPolling } from '@/lib/ui/analysis-status';

const now = new Date('2026-09-22T10:00:00.000Z');

describe('isAnalysisInFlight', () => {
  it('is true for an analyzing event updated within the stale window', () => {
    expect(isAnalysisInFlight({ status: 'analyzing', statusUpdatedAt: '2026-09-22T09:58:00.000Z' }, now)).toBe(true);
  });

  it('is false for a stale analyzing event', () => {
    expect(isAnalysisInFlight({ status: 'analyzing', statusUpdatedAt: '2026-09-22T09:56:59.000Z' }, now)).toBe(false);
  });

  it('is false for analyzing without a timestamp and for other statuses', () => {
    expect(isAnalysisInFlight({ status: 'analyzing', statusUpdatedAt: null }, now)).toBe(false);
    expect(isAnalysisInFlight({ status: 'failed', statusUpdatedAt: '2026-09-22T09:59:59.000Z' }, now)).toBe(false);
    expect(isAnalysisInFlight({ status: 'new', statusUpdatedAt: '2026-09-22T09:59:59.000Z' }, now)).toBe(false);
  });
});

describe('shouldKeepPolling', () => {
  it('polls while analysing within 5 minutes', () => {
    expect(POLL_TIMEOUT_MS).toBe(300_000);
    expect(shouldKeepPolling({ hasReport: false, status: 'analyzing', elapsedMs: 10_000 })).toBe('poll');
  });

  it('stops when the report is there or the analysis failed', () => {
    expect(shouldKeepPolling({ hasReport: true, status: 'done', elapsedMs: 0 })).toBe('stop');
    expect(shouldKeepPolling({ hasReport: false, status: 'failed', elapsedMs: 0 })).toBe('stop');
  });

  it('times out after 5 minutes without a report', () => {
    expect(shouldKeepPolling({ hasReport: false, status: 'analyzing', elapsedMs: POLL_TIMEOUT_MS })).toBe('timeout');
  });
});
