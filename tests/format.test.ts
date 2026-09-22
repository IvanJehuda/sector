import { describe, expect, it } from 'vitest';
import { formatIdrBillion, formatPct } from '@/lib/format';

describe('format', () => {
  it('formats percentages with Indonesian decimal comma and sign', () => {
    expect(formatPct(-0.072)).toBe('-7,2%');
    expect(formatPct(0.015)).toBe('+1,5%');
    expect(formatPct(0)).toBe('0,0%');
  });
  it('formats IDR in billions without sign', () => {
    expect(formatIdrBillion(-5_000_000_000)).toBe('Rp 5,0 miliar');
    expect(formatIdrBillion(146_476_750_000)).toBe('Rp 146,5 miliar');
  });
});
