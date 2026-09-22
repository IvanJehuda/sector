/** Guards for analyses triggered by anonymous visitors through POST /api/analyze. */

export const DEFAULT_PUBLIC_DAILY_LIMIT = 20;
/** Share of the Sectors credit budget public analyses may use; the rest is reserved for seeding and the demo. */
export const DEFAULT_PUBLIC_BUDGET_RATIO = 0.7;

export interface PublicAnalysisConfig {
  dailyLimit: number;
  publicRatio: number;
}

export function publicAnalysisConfig(env: Record<string, string | undefined> = process.env): PublicAnalysisConfig {
  const limit = Number(env.PUBLIC_ANALYSIS_DAILY_LIMIT);
  const ratio = Number(env.PUBLIC_ANALYSIS_BUDGET_RATIO);
  return {
    dailyLimit: env.PUBLIC_ANALYSIS_DAILY_LIMIT && Number.isInteger(limit) && limit >= 0 ? limit : DEFAULT_PUBLIC_DAILY_LIMIT,
    publicRatio: env.PUBLIC_ANALYSIS_BUDGET_RATIO && Number.isFinite(ratio) && ratio >= 0 && ratio <= 1 ? ratio : DEFAULT_PUBLIC_BUDGET_RATIO,
  };
}

/** Returns an Indonesian message explaining why a new public analysis is refused, or null when allowed. */
export function publicAnalysisBlockReason(p: {
  used: number;
  budget: number;
  analysesLast24h: number;
  dailyLimit: number;
  publicRatio: number;
}): string | null {
  if (p.used >= p.budget * p.publicRatio) {
    return 'Kuota kredit untuk analisis publik sudah habis. Laporan yang sudah ada tetap bisa dibuka.';
  }
  if (p.analysesLast24h >= p.dailyLimit) {
    return 'Batas analisis harian sudah tercapai. Coba lagi besok atau buka laporan yang sudah ada.';
  }
  return null;
}
