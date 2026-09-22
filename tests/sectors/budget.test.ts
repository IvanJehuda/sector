import { describe, expect, it } from 'vitest';
import { budgetState, canSpend } from '@/lib/sectors/budget';

describe('budgetState', () => {
  it('is ok below 80%, warn from 80%, blocked from 90%', () => {
    expect(budgetState(0, 1000)).toBe('ok');
    expect(budgetState(799, 1000)).toBe('ok');
    expect(budgetState(800, 1000)).toBe('warn');
    expect(budgetState(900, 1000)).toBe('blocked');
  });
});

describe('canSpend', () => {
  it('allows spending up to the 90% line only', () => {
    expect(canSpend(899, 1, 1000)).toBe(true);
    expect(canSpend(899, 2, 1000)).toBe(false);
  });
});
