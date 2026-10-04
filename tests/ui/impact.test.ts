import { describe, expect, it } from 'vitest';
import { findBannedPhrases } from '@/lib/explain/guard';
import {
  IMPACT_LABEL,
  IMPACT_NOTE_AI,
  IMPACT_NOTE_PAST,
  IMPACT_TITLE,
  buildImpactRows,
  impactColumns,
  vsMarketPhrase,
} from '@/lib/ui/impact';

const base: Parameters<typeof buildImpactRows>[0] = { mode: 'retrospective', hypotheses: [], subSectorSummary: [], analogs: [] };

describe('buildImpactRows', () => {
  it('joins hypothesis, reaction and history for the same sub-sector, ignoring case', () => {
    const rows = buildImpactRows({
      ...base,
      hypotheses: [{ subSector: 'Banks', direction: 'negatif', reason: 'Porsi laba naik.' }],
      subSectorSummary: [{ subSector: 'banks', avgCar: -0.032, count: 4 }],
      analogs: [{ subSector: 'BANKS', eventCount: 3, avgCar: -0.021 }],
    });
    expect(rows).toEqual([
      {
        subSector: 'Banks',
        hypothesis: { direction: 'negatif', reason: 'Porsi laba naik.' },
        actual: { avgCar: -0.032, count: 4 },
        history: { eventCount: 3, avgCar: -0.021 },
      },
    ]);
  });

  it('lists hypotheses first, then measured reactions by stock count, then history only', () => {
    const rows = buildImpactRows({
      ...base,
      hypotheses: [{ subSector: 'Telecommunication', direction: 'positif', reason: 'Tarif turun.' }],
      subSectorSummary: [
        { subSector: 'Banks', avgCar: -0.01, count: 1 },
        { subSector: 'Insurance', avgCar: 0.01, count: 3 },
      ],
      analogs: [{ subSector: 'Utilities', eventCount: 2, avgCar: 0.004 }],
    });
    expect(rows.map((r) => r.subSector)).toEqual(['Telecommunication', 'Insurance', 'Banks', 'Utilities']);
  });

  it('never shows a measured reaction on a hypothesis report', () => {
    const rows = buildImpactRows({
      ...base,
      mode: 'prospective',
      subSectorSummary: [{ subSector: 'Banks', avgCar: -0.01, count: 2 }],
      analogs: [{ subSector: 'Banks', eventCount: 1, avgCar: -0.02 }],
    });
    expect(rows).toEqual([{ subSector: 'Banks', hypothesis: null, actual: null, history: { eventCount: 1, avgCar: -0.02 } }]);
  });

  it('works for reports saved before hypotheses existed', () => {
    const rows = buildImpactRows({ mode: 'retrospective', subSectorSummary: [{ subSector: 'Banks', avgCar: -0.05, count: 1 }], analogs: [] });
    expect(rows).toEqual([{ subSector: 'Banks', hypothesis: null, actual: { avgCar: -0.05, count: 1 }, history: null }]);
  });

  it('returns no rows when nothing is known', () => {
    expect(buildImpactRows(base)).toEqual([]);
  });
});

describe('impactColumns', () => {
  it('hides the AI column when no row has a hypothesis, and the reaction column on hypothesis reports', () => {
    const plain = buildImpactRows({ ...base, subSectorSummary: [{ subSector: 'Banks', avgCar: -0.05, count: 1 }] });
    expect(impactColumns(plain, 'retrospective')).toEqual({ hypothesis: false, actual: true });
    const guessed = buildImpactRows({ ...base, hypotheses: [{ subSector: 'Banks', direction: 'negatif', reason: 'Uji.' }] });
    expect(impactColumns(guessed, 'prospective')).toEqual({ hypothesis: true, actual: false });
  });
});

describe('vsMarketPhrase', () => {
  it('reads naturally, including when the move matches the market', () => {
    expect(vsMarketPhrase(-0.041)).toBe('turun 4,1% lebih dalam dari pasar');
    expect(vsMarketPhrase(0.015)).toBe('naik 1,5% lebih tinggi dari pasar');
    expect(vsMarketPhrase(0.0002)).toBe('sama dengan pasar');
  });
});

describe('impact copy', () => {
  it('words directions as impact, never as advice', () => {
    for (const text of [...Object.values(IMPACT_LABEL), IMPACT_TITLE, IMPACT_NOTE_AI, IMPACT_NOTE_PAST]) {
      expect(findBannedPhrases(text)).toEqual([]);
    }
  });
});
