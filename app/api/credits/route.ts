import { getDb } from '@/lib/db/client';
import { budgetState } from '@/lib/sectors/budget';
import { creditBudget } from '@/lib/sectors/from-env';
import { dbLedger } from '@/lib/sectors/stores';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const used = await dbLedger(await getDb()).total();
  const budget = creditBudget();
  return Response.json({ used, budget, state: budgetState(used, budget) });
}
