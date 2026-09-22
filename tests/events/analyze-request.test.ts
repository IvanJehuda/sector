import { describe, expect, it } from 'vitest';
import { AnalyzeBodySchema, isCalendarDay } from '@/lib/events/analyze-request';

describe('isCalendarDay', () => {
  it.each(['2026-03-02', '2024-02-29', '2026-12-31'])('accepts %s', (d) => {
    expect(isCalendarDay(d)).toBe(true);
  });

  it.each(['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-3-2', '02-03-2026', ''])('rejects %j', (d) => {
    expect(isCalendarDay(d)).toBe(false);
  });
});

describe('AnalyzeBodySchema', () => {
  it('accepts a pasted text with a valid date', () => {
    expect(AnalyzeBodySchema.safeParse({ text: 'abc', date: '2026-03-02' }).success).toBe(true);
  });

  it('rejects impossible dates', () => {
    expect(AnalyzeBodySchema.safeParse({ text: 'abc', date: '2026-02-30' }).success).toBe(false);
  });

  it('accepts only http(s) URLs', () => {
    expect(AnalyzeBodySchema.safeParse({ url: 'https://example.com/a' }).success).toBe(true);
    expect(AnalyzeBodySchema.safeParse({ url: 'http://example.com/a' }).success).toBe(true);
    expect(AnalyzeBodySchema.safeParse({ url: 'ftp://example.com/a' }).success).toBe(false);
    expect(AnalyzeBodySchema.safeParse({ url: 'file:///etc/passwd' }).success).toBe(false);
    expect(AnalyzeBodySchema.safeParse({ url: 'javascript:alert(1)' }).success).toBe(false);
  });
});
