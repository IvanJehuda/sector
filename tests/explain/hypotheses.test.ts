import { describe, expect, it } from 'vitest';
import { toReportHypotheses } from '@/lib/explain/hypotheses';

describe('toReportHypotheses', () => {
  it('maps the profile shape to the report shape and trims the reason', () => {
    expect(toReportHypotheses([{ sub_sector: 'Banks', direction: 'negatif', reason: '  Porsi laba ke negara naik.  ' }])).toEqual([
      { subSector: 'Banks', direction: 'negatif', reason: 'Porsi laba ke negara naik.' },
    ]);
  });

  it('drops reasons that read as investment advice', () => {
    expect(toReportHypotheses([{ sub_sector: 'Banks', direction: 'negatif', reason: 'Sebaiknya jual saham bank.' }])).toEqual([]);
  });

  it('drops empty reasons', () => {
    expect(toReportHypotheses([{ sub_sector: 'Banks', direction: 'tidak jelas', reason: '   ' }])).toEqual([]);
  });

  it('keeps the first usable hypothesis per sub-sector, ignoring case', () => {
    expect(
      toReportHypotheses([
        { sub_sector: 'Banks', direction: 'negatif', reason: 'Beli sekarang.' },
        { sub_sector: 'banks', direction: 'positif', reason: 'Laba naik.' },
        { sub_sector: 'Banks', direction: 'negatif', reason: 'Alasan lain.' },
      ]),
    ).toEqual([{ subSector: 'banks', direction: 'positif', reason: 'Laba naik.' }]);
  });
});
