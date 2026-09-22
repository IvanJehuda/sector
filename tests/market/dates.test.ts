import { describe, expect, it } from 'vitest';
import { addDays, eventCalendarDate, firstTradingDayOnOrAfter, priceWindow } from '@/lib/market/dates';

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('eventCalendarDate', () => {
  it('treats timestamps without offset as WIB', () => {
    expect(eventCalendarDate('2026-07-09T10:00:00')).toBe('2026-07-09');
    expect(eventCalendarDate('2026-07-09T18:05:00')).toBe('2026-07-10');
  });
  it('converts timestamps with an offset to WIB', () => {
    expect(eventCalendarDate('2026-07-09T02:00:00Z')).toBe('2026-07-09');
    expect(eventCalendarDate('2026-07-09T10:00:00Z')).toBe('2026-07-10');
    expect(eventCalendarDate('2026-07-09T15:30:00+07:00')).toBe('2026-07-09');
  });
  it('keeps plain dates', () => {
    expect(eventCalendarDate('2026-07-09')).toBe('2026-07-09');
  });
  it.each(['', 'kemarin', '2026-13-45T10:00:00'])('throws a clear error for unparseable input %j', (bad) => {
    expect(() => eventCalendarDate(bad)).toThrow(`Invalid publishedAt: ${bad}`);
  });
});

describe('priceWindow', () => {
  it('ends on the 15th when eventDay+10 falls in the first half', () => {
    expect(priceWindow('2026-03-02', '2026-09-22')).toEqual({ start: '2025-12-16', end: '2026-03-15' });
  });
  it('ends on the last day of the month otherwise', () => {
    expect(priceWindow('2026-03-10', '2026-09-22')).toEqual({ start: '2026-01-01', end: '2026-03-31' });
  });
  it('shares one window for nearby events (cache reuse)', () => {
    expect(priceWindow('2026-03-01', '2026-09-22')).toEqual(priceWindow('2026-03-05', '2026-09-22'));
  });
  it('is capped at today', () => {
    expect(priceWindow('2026-09-20', '2026-09-22')).toEqual({ start: '2026-06-25', end: '2026-09-22' });
  });
});

describe('firstTradingDayOnOrAfter', () => {
  it('skips weekends and holidays using real trading days', () => {
    expect(firstTradingDayOnOrAfter(['2026-03-13', '2026-03-16'], '2026-03-14')).toBe('2026-03-16');
    expect(firstTradingDayOnOrAfter(['2026-03-13'], '2026-03-13')).toBe('2026-03-13');
    expect(firstTradingDayOnOrAfter(['2026-03-13'], '2026-03-14')).toBeNull();
  });
});
