import { describe, expect, it } from 'vitest';
import { findAnalogs } from '@/lib/history/analogs';
import { makeCandidate, makeReaction, makeReport } from '../helpers/factories';

function finding(symbol: string, subSector: string, car: number | null) {
  return {
    candidate: makeCandidate({ symbol, subSector }),
    reaction: car === null ? null : makeReaction({ car }),
    netForeignInflow: null,
    confidence: 'sedang' as const,
    explanation: '',
    dataNote: null,
  };
}

const reports = [
  makeReport({ eventId: 'e1', eventType: 'kebijakan', findings: [finding('BBRI', 'Banks', -0.06), finding('BMRI', 'Banks', -0.02)] }),
  makeReport({ eventId: 'e2', eventType: 'kebijakan', findings: [finding('BBNI', 'Banks', -0.04), finding('PTBA', 'Coal', 0.03)] }),
  makeReport({ eventId: 'e3', eventType: 'makro', findings: [finding('BBCA', 'Banks', 0.05)] }),
  makeReport({ eventId: 'e4', eventType: 'kebijakan', mode: 'prospective', findings: [finding('BBRI', 'Banks', null)] }),
];

describe('findAnalogs', () => {
  it('aggregates matching retrospective reports per requested sub-sector', () => {
    const out = findAnalogs(reports, 'kebijakan', ['banks']);
    expect(out).toHaveLength(1);
    expect(out[0].subSector).toBe('Banks');
    expect(out[0].eventCount).toBe(2);
    expect(out[0].avgCar).toBeCloseTo(-0.04, 10);
  });

  it('excludes the current event and unrelated sub-sectors', () => {
    const out = findAnalogs(reports, 'kebijakan', ['Banks', 'Coal'], 'e1');
    expect(out.map((a) => [a.subSector, a.eventCount])).toEqual([
      ['Banks', 1],
      ['Coal', 1],
    ]);
  });

  it('returns nothing without matching history', () => {
    expect(findAnalogs(reports, 'geopolitik', ['Banks'])).toEqual([]);
  });
});
