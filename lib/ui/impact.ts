import type { ImpactDirection, Mode, Report } from '@/lib/domain';
import { describeVsMarket } from './present';

export const IMPACT_LABEL: Record<ImpactDirection, string> = {
  negatif: 'Tekanan',
  positif: 'Dorongan',
  'tidak jelas': 'Belum jelas',
};
export const IMPACT_TITLE = 'Dampak per bidang usaha';
export const IMPACT_NOTE_AI = 'Dugaan AI disusun dari isi berita, bukan perkiraan harga.';
export const IMPACT_NOTE_PAST = 'Masa lalu tidak menjamin gerak berikutnya.';

export interface ImpactRow {
  subSector: string;
  hypothesis: { direction: ImpactDirection; reason: string } | null;
  actual: { avgCar: number; count: number } | null;
  history: { eventCount: number; avgCar: number } | null;
}

/**
 * One row per sub-sector, joining the AI hypothesis, the measured reaction and similar past news.
 * Hypotheses come first in the AI's order, then measured reactions by stock count, then history only.
 */
export function buildImpactRows(report: Pick<Report, 'mode' | 'hypotheses' | 'subSectorSummary' | 'analogs'>): ImpactRow[] {
  const rows = new Map<string, ImpactRow>();
  const row = (name: string): ImpactRow => {
    const key = name.toLowerCase();
    let r = rows.get(key);
    if (!r) {
      r = { subSector: name, hypothesis: null, actual: null, history: null };
      rows.set(key, r);
    }
    return r;
  };
  for (const h of report.hypotheses ?? []) row(h.subSector).hypothesis = { direction: h.direction, reason: h.reason };
  if (report.mode === 'retrospective') {
    for (const s of [...report.subSectorSummary].sort((a, b) => b.count - a.count)) {
      row(s.subSector).actual = { avgCar: s.avgCar, count: s.count };
    }
  }
  for (const a of report.analogs) row(a.subSector).history = { eventCount: a.eventCount, avgCar: a.avgCar };
  return [...rows.values()];
}

/** Which optional columns to show: the AI column only when some row has a hypothesis, the reaction column only after the fact. */
export function impactColumns(rows: ImpactRow[], mode: Mode): { hypothesis: boolean; actual: boolean } {
  return { hypothesis: rows.some((r) => r.hypothesis !== null), actual: mode === 'retrospective' };
}

/** "turun 4,1% lebih dalam dari pasar", or "sama dengan pasar" when the move rounds to zero. */
export function vsMarketPhrase(car: number): string {
  const text = describeVsMarket(car);
  return text === 'Sama dengan pasar' ? 'sama dengan pasar' : `${text.toLowerCase()} dari pasar`;
}
