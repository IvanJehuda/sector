import { describe, expect, it } from 'vitest';
import { normalizeSymbol, todayWib } from '@/lib/domain';

describe('normalizeSymbol', () => {
  it('uppercases and strips the .JK suffix', () => {
    expect(normalizeSymbol('bbca.jk')).toBe('BBCA');
    expect(normalizeSymbol(' TLKM ')).toBe('TLKM');
    expect(normalizeSymbol('BBRI.JK')).toBe('BBRI');
  });
});

describe('todayWib', () => {
  it('returns the WIB calendar date', () => {
    expect(todayWib(new Date('2026-09-21T16:59:00Z'))).toBe('2026-09-21');
    expect(todayWib(new Date('2026-09-21T17:00:00Z'))).toBe('2026-09-22');
  });
});
