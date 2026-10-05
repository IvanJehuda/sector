import { describe, expect, it } from 'vitest';
import { pickRemeasure, type RemeasureCandidate } from '@/lib/events/remeasure-pick';

const TODAY = '2026-10-05'; // Monday

const report = (eventId: string, publishedAt: string, lastAttempt: string | null = null): RemeasureCandidate => ({
  eventId,
  publishedAt,
  lastAttempt,
});

describe('pickRemeasure', () => {
  it('picks a hypothesis report once the session after its news has closed', () => {
    expect(pickRemeasure([report('a', '2026-10-02T09:00:00')], TODAY)).toBe('a');
  });

  it('waits for the Monday close on Friday-evening news', () => {
    // After 16:00 WIB on Friday the event day is Saturday, so Monday is the first session.
    expect(pickRemeasure([report('a', '2026-10-02T19:50:00')], TODAY)).toBeNull();
    expect(pickRemeasure([report('a', '2026-10-02T19:50:00')], '2026-10-06')).toBe('a');
  });

  it('tries each report at most once a day', () => {
    expect(pickRemeasure([report('a', '2026-10-01T09:00:00', TODAY)], TODAY)).toBeNull();
    expect(pickRemeasure([report('a', '2026-10-01T09:00:00', '2026-10-02')], TODAY)).toBe('a');
  });

  it('skips reports whose date cannot be read', () => {
    expect(pickRemeasure([report('a', 'bukan tanggal'), report('b', '2026-10-01T09:00:00')], TODAY)).toBe('b');
  });

  it('prefers the newest news, which is what the homepage shows', () => {
    expect(pickRemeasure([report('old', '2026-09-30T09:00:00'), report('new', '2026-10-01T09:00:00')], TODAY)).toBe('new');
  });

  it('returns null when nothing is waiting', () => {
    expect(pickRemeasure([], TODAY)).toBeNull();
  });
});
