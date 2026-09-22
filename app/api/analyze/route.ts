import { after } from 'next/server';
import { ANALYSIS_STALE_MS, claimEventForAnalysis, countRecentAnalyses, getEvent, getReport, insertEvent } from '@/lib/db/repo';
import { todayWib, type StoredEvent } from '@/lib/domain';
import { AnalyzeBodySchema } from '@/lib/events/analyze-request';
import { ArticleFetchError } from '@/lib/events/article';
import { buildManualEvent, InputError } from '@/lib/events/manual';
import { analyzeEvent } from '@/lib/pipeline/analyze';
import { pipelineFromEnv } from '@/lib/pipeline/from-env';
import { publicAnalysisBlockReason, publicAnalysisConfig } from '@/lib/pipeline/guard';
import { creditBudget } from '@/lib/sectors/from-env';

export const dynamic = 'force-dynamic';
/** Upper bound for the after() analysis; a killed run is re-claimable once its status goes stale. */
export const maxDuration = 60;

const DAY_MS = 86_400_000;

export async function POST(req: Request): Promise<Response> {
  const parsed = AnalyzeBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Input tidak valid.' }, { status: 400 });

  const deps = await pipelineFromEnv();
  const { db } = deps;
  let event: StoredEvent;
  if (parsed.data.eventId) {
    const found = await getEvent(db, parsed.data.eventId);
    if (!found) return Response.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
    event = found;
  } else {
    try {
      const input = await buildManualEvent(parsed.data, todayWib());
      event = (await insertEvent(db, input)).event;
    } catch (err) {
      if (err instanceof InputError || err instanceof ArticleFetchError) {
        return Response.json({ error: err.message, needText: true }, { status: 422 });
      }
      throw err;
    }
  }
  const id = event.id;

  // Reopening an existing report is always free.
  if (await getReport(db, id)) return Response.json({ eventId: id }, { status: 202 });

  const now = new Date();
  const { dailyLimit, publicRatio } = publicAnalysisConfig();
  const blocked = publicAnalysisBlockReason({
    used: await deps.ledger.total(),
    budget: creditBudget(),
    analysesLast24h: await countRecentAnalyses(db, new Date(now.getTime() - DAY_MS).toISOString()),
    dailyLimit,
    publicRatio,
  });
  if (blocked) return Response.json({ error: blocked }, { status: 429 });

  const claimed = await claimEventForAnalysis(db, id, now.toISOString(), new Date(now.getTime() - ANALYSIS_STALE_MS).toISOString());
  // Not claimed: another request is already analysing this event; the client just follows its progress.
  if (!claimed) return Response.json({ eventId: id }, { status: 202 });

  after(async () => {
    try {
      await analyzeEvent(id, deps);
    } catch (err) {
      console.error('analyzeEvent failed', id, err);
    }
  });
  return Response.json({ eventId: id }, { status: 202 });
}
