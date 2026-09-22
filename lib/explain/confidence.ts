import type { Candidate, Confidence, Reaction } from '@/lib/domain';

export const PROSPECTIVE_MIN_ANALOGS = 3;

export function scoreRetrospective(c: Candidate, r: Reaction | null, marketWide: boolean): Confidence {
  if (!r || !r.significant) return 'rendah';
  if (!marketWide && (c.linkType === 'direct' || c.linkType === 'group')) return 'tinggi';
  return 'sedang';
}

/** Prospective findings are hypotheses: never 'tinggi'. */
export function scoreProspective(analogEventCount: number): Confidence {
  return analogEventCount >= PROSPECTIVE_MIN_ANALOGS ? 'sedang' : 'rendah';
}
