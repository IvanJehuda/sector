import { after } from 'next/server';
import { isCronAuthorized } from '@/lib/cron/auth';
import { todayWib } from '@/lib/domain';
import { analyzeEvent } from '@/lib/pipeline/analyze';
import { claimAutoAnalysis } from '@/lib/pipeline/auto';
import { pipelineFromEnv, pollFromEnv } from '@/lib/pipeline/from-env';
import { publicAnalysisConfig } from '@/lib/pipeline/guard';
import { creditBudget } from '@/lib/sectors/from-env';

export const dynamic = 'force-dynamic';
/** Upper bound for the after() analysis; a killed run is re-claimable once its status goes stale. */
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  if (!isCronAuthorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const poll = await pollFromEnv();

  // After each poll, analyse at most one policy article so the homepage fills without anyone clicking.
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
    const id = auto.eventId;
    after(async () => {
      try {
        await analyzeEvent(id, deps);
      } catch (err) {
        console.error('auto analyzeEvent failed', id, err);
      }
    });
  }
  return Response.json({ ...poll, auto });
}
