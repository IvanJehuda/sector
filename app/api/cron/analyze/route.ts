import { after } from 'next/server';
import { isCronAuthorized } from '@/lib/cron/auth';
import { todayWib } from '@/lib/domain';
import { analyzeEvent } from '@/lib/pipeline/analyze';
import { claimAutoAnalysis } from '@/lib/pipeline/auto';
import { pipelineFromEnv } from '@/lib/pipeline/from-env';
import { publicAnalysisConfig } from '@/lib/pipeline/guard';
import { creditBudget } from '@/lib/sectors/from-env';

export const dynamic = 'force-dynamic';
/**
 * Upper bound for the after() analysis. Kept apart from the news poll so each gets its own budget.
 * A run killed at the limit stays 'analyzing': automatic runs never retry it, and a visitor can
 * re-claim it once its status goes stale.
 */
export const maxDuration = 60;

/** Called by the scheduled workflow after each poll: re-measures one hypothesis report, or analyses one policy article. */
export async function GET(req: Request): Promise<Response> {
  if (!isCronAuthorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const deps = await pipelineFromEnv();
  const auto = await claimAutoAnalysis({
    db: deps.db,
    ledger: deps.ledger,
    budget: creditBudget(),
    config: publicAnalysisConfig(),
    today: todayWib(),
    now: new Date(),
  });
  if ('eventId' in auto) {
    const { eventId: id, refresh } = auto;
    after(async () => {
      try {
        await analyzeEvent(id, deps, { refresh });
      } catch (err) {
        console.error('auto analyzeEvent failed', id, err);
      }
    });
  }
  return Response.json(auto);
}
