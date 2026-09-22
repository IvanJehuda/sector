import { describe, expect, it } from 'vitest';
import { isCronAuthorized } from '@/lib/cron/auth';

describe('isCronAuthorized', () => {
  it('accepts the exact bearer secret', () => {
    expect(isCronAuthorized('Bearer s3cret', 's3cret')).toBe(true);
  });

  it('rejects wrong, missing, differently sized or unprefixed values', () => {
    expect(isCronAuthorized('Bearer s3creT', 's3cret')).toBe(false);
    expect(isCronAuthorized('Bearer s3cret-longer', 's3cret')).toBe(false);
    expect(isCronAuthorized('Bearer s3', 's3cret')).toBe(false);
    expect(isCronAuthorized('s3cret', 's3cret')).toBe(false);
    expect(isCronAuthorized(null, 's3cret')).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    expect(isCronAuthorized('Bearer ', '')).toBe(false);
    expect(isCronAuthorized('Bearer undefined', undefined)).toBe(false);
  });
});
