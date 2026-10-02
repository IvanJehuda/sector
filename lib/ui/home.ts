import type { StoredEvent } from '@/lib/domain';

export const RECENT_REPORTS_LABEL = '// LAPORAN TERBARU //';
export const RECENT_REPORTS_TITLE = 'Berita yang sudah dianalisis';
export const RECENT_REPORTS_LINK = 'Lihat laporan';

/** Drops events already shown elsewhere on the page, keeping the original order. */
export function excludeShown(events: StoredEvent[], shown: StoredEvent[]): StoredEvent[] {
  const ids = new Set(shown.map((e) => e.id));
  return events.filter((e) => !ids.has(e.id));
}

/** Short ticker list for a card: a dash when empty, and a count of what does not fit. */
export function symbolsLabel(symbols: string[], max = 4): string {
  if (symbols.length === 0) return '—';
  const shown = symbols.slice(0, max).join(' · ');
  const rest = symbols.length - max;
  return rest > 0 ? `${shown} +${rest}` : shown;
}
