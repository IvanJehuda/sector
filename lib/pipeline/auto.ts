import type { Db } from '@/lib/db/client';
import { ANALYSIS_STALE_MS, claimEventForAnalysis, countRecentAnalyses, listEvents } from '@/lib/db/repo';
import { pickAutoAnalysis } from '@/lib/events/auto-pick';
import type { CreditLedger } from '@/lib/sectors/stores';
import { publicAnalysisBlockReason, type PublicAnalysisConfig } from './guard';

const DAY_MS = 86_400_000;
/** Recent events to scan for a candidate; about four days of the Sectors feed. */
const SCAN_LIMIT = 200;

export type AutoAnalysisResult = { eventId: string } | { skipped: 'no-candidate' | 'blocked' | 'claimed-elsewhere' };

/**
 * Picks and claims at most one policy article to analyse after a news poll; the caller runs the analysis.
 * Goes through the same guard as visitor analyses, so automatic runs cannot spend past the limits set for them.
 */
export async function claimAutoAnalysis(deps: {
  db: Db;
  ledger: CreditLedger;
  budget: number;
  config: PublicAnalysisConfig;
  today: string;
  now: Date;
}): Promise<AutoAnalysisResult> {
  const pick = pickAutoAnalysis(await listEvents(deps.db, SCAN_LIMIT), deps.today);
  if (!pick) return { skipped: 'no-candidate' };

  const blocked = publicAnalysisBlockReason({
    used: await deps.ledger.total(),
    budget: deps.budget,
    analysesLast24h: await countRecentAnalyses(deps.db, new Date(deps.now.getTime() - DAY_MS).toISOString()),
    dailyLimit: deps.config.dailyLimit,
    publicRatio: deps.config.publicRatio,
  });
  if (blocked) return { skipped: 'blocked' };

  const nowIso = deps.now.toISOString();
  const staleBefore = new Date(deps.now.getTime() - ANALYSIS_STALE_MS).toISOString();
  return (await claimEventForAnalysis(deps.db, pick.id, nowIso, staleBefore)) ? { eventId: pick.id } : { skipped: 'claimed-elsewhere' };
}
