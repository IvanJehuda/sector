import { describe, expect, it } from 'vitest';
import { cacheKey, canonicalQuery, fixtureFileName } from '@/lib/sectors/keys';

describe('canonicalQuery', () => {
  it('sorts keys, drops undefined and encodes values', () => {
    expect(canonicalQuery({ b: 2, a: 'x y', c: undefined })).toBe('a=x%20y&b=2');
  });
});

describe('cacheKey', () => {
  it('is independent of param order', () => {
    expect(cacheKey('/v2/daily/BBCA/', { end: '2026-01-31', start: '2026-01-01' })).toBe(
      cacheKey('/v2/daily/BBCA/', { start: '2026-01-01', end: '2026-01-31' }),
    );
  });
  it('omits the question mark when there are no params', () => {
    expect(cacheKey('/v2/subsectors/', {})).toBe('/v2/subsectors/');
  });
});

describe('fixtureFileName', () => {
  it('is readable, stable and unique per key', () => {
    const a = fixtureFileName('/v2/daily/BBCA/?end=2026-01-31&start=2026-01-01');
    const b = fixtureFileName('/v2/daily/BBCA/?end=2026-02-28&start=2026-02-01');
    expect(a).toMatch(/^v2_daily_BBCA__[0-9a-f]{10}\.json$/);
    expect(a).toBe(fixtureFileName('/v2/daily/BBCA/?end=2026-01-31&start=2026-01-01'));
    expect(a).not.toBe(b);
  });
});
