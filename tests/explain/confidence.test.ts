import { describe, expect, it } from 'vitest';
import { scoreProspective, scoreRetrospective } from '@/lib/explain/confidence';
import { makeCandidate, makeReaction } from '../helpers/factories';

describe('scoreRetrospective', () => {
  it('is tinggi only for significant, non-market-wide, direct/group links', () => {
    expect(scoreRetrospective(makeCandidate({ linkType: 'direct' }), makeReaction(), false)).toBe('tinggi');
    expect(scoreRetrospective(makeCandidate({ linkType: 'group' }), makeReaction(), false)).toBe('tinggi');
    expect(scoreRetrospective(makeCandidate({ linkType: 'direct' }), makeReaction(), true)).toBe('sedang');
    expect(scoreRetrospective(makeCandidate({ linkType: 'sector' }), makeReaction(), false)).toBe('sedang');
  });
  it('is rendah without a significant reaction', () => {
    expect(scoreRetrospective(makeCandidate(), makeReaction({ significant: false }), false)).toBe('rendah');
    expect(scoreRetrospective(makeCandidate(), null, false)).toBe('rendah');
  });
});

describe('scoreProspective', () => {
  it('never exceeds sedang', () => {
    expect(scoreProspective(0)).toBe('rendah');
    expect(scoreProspective(2)).toBe('rendah');
    expect(scoreProspective(3)).toBe('sedang');
    expect(scoreProspective(50)).toBe('sedang');
  });
});
