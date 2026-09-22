import { describe, expect, it } from 'vitest';
import { mean, precisionRecall } from '@/lib/eval/score';

describe('precisionRecall', () => {
  it('compares case-insensitively', () => {
    expect(precisionRecall(['BBRI', 'BMRI'], ['bbri', 'TLKM'])).toEqual({ precision: 0.5, recall: 0.5 });
  });
  it('handles empty sides', () => {
    expect(precisionRecall(['BBRI'], [])).toEqual({ precision: 0, recall: 0 });
    expect(precisionRecall([], [])).toEqual({ precision: 1, recall: 1 });
    expect(precisionRecall([], ['BBRI'])).toEqual({ precision: 0, recall: 1 });
  });
});

describe('mean', () => {
  it('averages and returns 0 for empty input', () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBe(0);
  });
});
