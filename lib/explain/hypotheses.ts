import type { ImpactDirection, SubSectorHypothesis } from '@/lib/domain';
import { findBannedPhrases } from './guard';

/** The AI's per-sub-sector impact hypotheses, safe to store and show: no advice wording, one per sub-sector. */
export function toReportHypotheses(
  hypotheses: { sub_sector: string; direction: ImpactDirection; reason: string }[],
): SubSectorHypothesis[] {
  const seen = new Set<string>();
  const out: SubSectorHypothesis[] = [];
  for (const h of hypotheses) {
    const reason = h.reason.trim();
    const key = h.sub_sector.toLowerCase();
    if (!reason || findBannedPhrases(reason).length > 0 || seen.has(key)) continue;
    seen.add(key);
    out.push({ subSector: h.sub_sector, direction: h.direction, reason });
  }
  return out;
}
