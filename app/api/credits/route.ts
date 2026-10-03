import { isCronAuthorized } from '@/lib/cron/auth';
import { getDb } from '@/lib/db/client';
import { budgetState } from '@/lib/sectors/budget';
import { creditBudget } from '@/lib/sectors/from-env';
import { dbLedger } from '@/lib/sectors/stores';

export const dynamic = 'force-dynamic';

/** Credit usage for the team. Needs the cron secret, so the figures never reach the public site. */
export async function GET(req: Request): Promise<Response> {
  if (!isCronAuthorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const used = await dbLedger(await getDb()).total();
  const budget = creditBudget();
  return Response.json({ used, budget, state: budgetState(used, budget) });
}
