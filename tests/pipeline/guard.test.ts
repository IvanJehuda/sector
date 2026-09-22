import { describe, expect, it } from 'vitest';
import { publicAnalysisBlockReason, publicAnalysisConfig } from '@/lib/pipeline/guard';

const ok = { used: 0, budget: 1000, analysesLast24h: 0, dailyLimit: 20, publicRatio: 0.7 };

describe('publicAnalysisBlockReason', () => {
  it('returns null when under both limits', () => {
    expect(publicAnalysisBlockReason(ok)).toBeNull();
    expect(publicAnalysisBlockReason({ ...ok, used: 699, analysesLast24h: 19 })).toBeNull();
  });

  it('blocks when the public share of the credit budget is used up (boundary inclusive)', () => {
    const msg = 'Kuota kredit untuk analisis publik sudah habis. Laporan yang sudah ada tetap bisa dibuka.';
    expect(publicAnalysisBlockReason({ ...ok, used: 700 })).toBe(msg);
    expect(publicAnalysisBlockReason({ ...ok, used: 950 })).toBe(msg);
  });

  it('blocks when the daily analysis limit is reached (boundary inclusive)', () => {
    const msg = 'Batas analisis harian sudah tercapai. Coba lagi besok atau buka laporan yang sudah ada.';
    expect(publicAnalysisBlockReason({ ...ok, analysesLast24h: 20 })).toBe(msg);
    expect(publicAnalysisBlockReason({ ...ok, analysesLast24h: 25 })).toBe(msg);
  });

  it('reports the credit reason first when both limits are hit', () => {
    expect(publicAnalysisBlockReason({ ...ok, used: 1000, analysesLast24h: 99 })).toMatch(/^Kuota kredit/);
  });
});

describe('publicAnalysisConfig', () => {
  it('defaults to 20 analyses per day and 70% of the budget', () => {
    expect(publicAnalysisConfig({})).toEqual({ dailyLimit: 20, publicRatio: 0.7 });
  });

  it('reads overrides from env and ignores invalid values', () => {
    expect(publicAnalysisConfig({ PUBLIC_ANALYSIS_DAILY_LIMIT: '5', PUBLIC_ANALYSIS_BUDGET_RATIO: '0.5' })).toEqual({
      dailyLimit: 5,
      publicRatio: 0.5,
    });
    expect(publicAnalysisConfig({ PUBLIC_ANALYSIS_DAILY_LIMIT: 'abc', PUBLIC_ANALYSIS_BUDGET_RATIO: '-1' })).toEqual({
      dailyLimit: 20,
      publicRatio: 0.7,
    });
  });
});
