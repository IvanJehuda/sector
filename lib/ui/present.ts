import type { StockFinding } from '@/lib/domain';

/** Plain-language wording for numbers shown to people who do not follow the stock market. */

export const SHORT_DISCLAIMER = 'Ini analisis data harga masa lalu, bukan saran investasi.';

const pct = (x: number) => (Math.abs(x) * 100).toFixed(1).replace('.', ',');

/** Below this the difference rounds to 0,0% and reads as noise. */
const SAME_AS_MARKET = 0.0005;

export function describeVsMarket(car: number): string {
  if (Math.abs(car) < SAME_AS_MARKET) return 'Sama dengan pasar';
  return car < 0 ? `Turun ${pct(car)}% lebih dalam` : `Naik ${pct(car)}% lebih tinggi`;
}

/** Text colour for a move relative to the market: red below, green above, plain when flat. */
export function tone(x: number): string {
  return x < 0 ? 'text-down' : x > 0 ? 'text-up' : '';
}

/** The price columns only help when at least one stock has a measured reaction; hypothesis reports have none. */
export function showReactionColumns(findings: Pick<StockFinding, 'reaction'>[]): boolean {
  return findings.some((f) => f.reaction !== null);
}

export function unusualLabel(significant: boolean): string {
  return significant ? 'Tidak biasa' : 'Masih wajar';
}

export function formatRupiahBillion(x: number): string {
  const s = (Math.abs(x) / 1e9).toFixed(1).replace(/\.0$/, '').replace('.', ',');
  return `Rp${s} miliar`;
}

export function foreignFlowText(net: number | null): string | null {
  if (!net) return null;
  return `Investor asing lebih banyak ${net < 0 ? 'menjual' : 'membeli'}, ${formatRupiahBillion(net)}`;
}

const DATE_ID = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** `YYYY-MM-DD` (or an ISO timestamp's date part) → "2 Mar 2026". */
export function formatDateId(day: string): string {
  return DATE_ID.format(new Date(`${day.slice(0, 10)}T00:00:00Z`));
}

/** One box accepts a link or pasted text: a lone http(s) address is a link, anything else is text. */
export function splitNewsInput(raw: string): { url?: string; text?: string } {
  const value = raw.trim();
  if (!value) return {};
  return /^https?:\/\/\S+$/i.test(value) ? { url: value } : { text: value };
}
