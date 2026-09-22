export type BudgetState = 'ok' | 'warn' | 'blocked';

export const WARN_RATIO = 0.8;
export const BLOCK_RATIO = 0.9;

export function budgetState(used: number, budget: number): BudgetState {
  if (used >= budget * BLOCK_RATIO) return 'blocked';
  if (used >= budget * WARN_RATIO) return 'warn';
  return 'ok';
}

export function canSpend(used: number, cost: number, budget: number): boolean {
  return used + cost <= budget * BLOCK_RATIO;
}

export class CreditBudgetError extends Error {
  constructor(
    public readonly used: number,
    public readonly cost: number,
    public readonly budget: number,
  ) {
    super(`Sectors credit budget exhausted: ${used} used + ${cost} requested > ${budget * BLOCK_RATIO} allowed`);
    this.name = 'CreditBudgetError';
  }
}
