import type { Db } from '@/lib/db/client';
import { ANALYSIS_STALE_MS, claimEventForAnalysis, countRecentAnalyses, kvGet, kvSet, listEvents, listProspectiveReports } from '@/lib/db/repo';
import { pickAutoAnalysis } from '@/lib/events/auto-pick';
import { pickRemeasure } from '@/lib/events/remeasure-pick';
import type { CreditLedger } from '@/lib/sectors/stores';
import { publicAnalysisBlockReason, type PublicAnalysisConfig } from './guard';

const DAY_MS = 86_400_000;
/** Recent events to scan for a candidate; about four days of the Sectors feed. */
const SCAN_LIMIT = 200;

export type AutoAnalysisResult = { eventId: string; refresh?: true } | { skipped: 'no-candidate' | 'blocked' | 'claimed-elsewhere' };

/** kv key holding the WIB date a hypothesis report was last re-analysed. */
export const remeasureKey = (eventId: string) => `remeasure:${eventId}`;

/**
 * Picks and claims at most one analysis after a news poll; the caller runs it.
 * A hypothesis report whose next session has closed comes first (re-run with `refresh`); otherwise
 * the newest unanalysed policy article. Goes through the same guard as visitor analyses, so automatic
 * runs cannot spend past the limits set for them.
 */
export async function claimAutoAnalysis(deps: {
  db: Db;
  ledger: CreditLedger;
  budget: number;
  config: PublicAnalysisConfig;
  today: string;
  now: Date;
}): Promise<AutoAnalysisResult> {
  const pending = await listProspectiveReports(deps.db);
  const candidates = [];
  for (const p of pending) candidates.push({ ...p, lastAttempt: await kvGet(deps.db, remeasureKey(p.eventId)) });
  const remeasure = pickRemeasure(candidates, deps.today);
  const pick = remeasure ?? pickAutoAnalysis(await listEvents(deps.db, SCAN_LIMIT), deps.today)?.id ?? null;
  if (!pick) return { skipped: 'no-candidate' };

  const blocked = publicAnalysisBlockReason({
    used: await deps.ledger.total(),
    budget: deps.budget,
    analysesLast24h: await countRecentAnalyses(deps.db, new Date(deps.now.getTime() - DAY_MS).toISOString()),
    dailyLimit: deps.config.dailyLimit,
    publicRatio: deps.config.publicRatio,
  });
  if (blocked) return { skipped: 'blocked' };

  // Recorded before the claim: one attempt per report per day, even if the re-run fails or stays a hypothesis.
  if (remeasure) await kvSet(deps.db, remeasureKey(remeasure), deps.today);
  const nowIso = deps.now.toISOString();
  const staleBefore = new Date(deps.now.getTime() - ANALYSIS_STALE_MS).toISOString();
  if (!(await claimEventForAnalysis(deps.db, pick, nowIso, staleBefore))) return { skipped: 'claimed-elsewhere' };
  return remeasure ? { eventId: pick, refresh: true } : { eventId: pick };
}
