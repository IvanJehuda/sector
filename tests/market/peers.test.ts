import { describe, expect, it } from 'vitest';
import { summarizeSubSectors } from '@/lib/market/peers';
import { makeCandidate, makeReaction } from '../helpers/factories';

describe('summarizeSubSectors', () => {
  it('averages CAR per sub-sector and skips findings without data', () => {
    const findings = [
      { candidate: makeCandidate({ symbol: 'BBRI', subSector: 'Banks' }), reaction: makeReaction({ car: -0.08 }), netForeignInflow: null, confidence: 'tinggi' as const, explanation: '', dataNote: null },
      { candidate: makeCandidate({ symbol: 'BMRI', subSector: 'Banks' }), reaction: makeReaction({ car: -0.04 }), netForeignInflow: null, confidence: 'sedang' as const, explanation: '', dataNote: null },
      { candidate: makeCandidate({ symbol: 'PTBA', subSector: 'Coal' }), reaction: makeReaction({ car: 0.01 }), netForeignInflow: null, confidence: 'rendah' as const, explanation: '', dataNote: null },
      { candidate: makeCandidate({ symbol: 'TLKM', subSector: 'Telco' }), reaction: null, netForeignInflow: null, confidence: 'rendah' as const, explanation: '', dataNote: 'x' },
    ];
    const out = summarizeSubSectors(findings);
    expect(out.map((s) => s.subSector)).toEqual(['Banks', 'Coal']);
    expect(out[0].avgCar).toBeCloseTo(-0.06, 10);
    expect(out[0].count).toBe(2);
  });
});
