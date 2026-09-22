import { normalizeSymbol, todayWib, type Company, type MarketData, type PricePoint } from '@/lib/domain';
import type { NewsPage } from './endpoints';

/** DATA PALSU: hanya untuk dev UI, E2E dan test. Bukan data pasar sebenarnya. */
export const FAKE_UNIVERSE: Company[] = [
  { symbol: 'BBCA', name: 'PT Bank Central Asia Tbk', subSector: 'Banks', marketCap: 1.0e15 },
  { symbol: 'BBRI', name: 'PT Bank Rakyat Indonesia (Persero) Tbk', subSector: 'Banks', marketCap: 6.0e14 },
  { symbol: 'BMRI', name: 'PT Bank Mandiri (Persero) Tbk', subSector: 'Banks', marketCap: 5.0e14 },
  { symbol: 'BBNI', name: 'PT Bank Negara Indonesia (Persero) Tbk', subSector: 'Banks', marketCap: 1.5e14 },
  { symbol: 'TLKM', name: 'PT Telkom Indonesia (Persero) Tbk', subSector: 'Telecommunication', marketCap: 3.0e14 },
  { symbol: 'ADRO', name: 'PT Alamtri Resources Indonesia Tbk', subSector: 'Oil, Gas & Coal', marketCap: 6.0e13 },
  { symbol: 'PTBA', name: 'PT Bukit Asam Tbk', subSector: 'Oil, Gas & Coal', marketCap: 3.0e13 },
  { symbol: 'ANTM', name: 'PT Aneka Tambang Tbk', subSector: 'Basic Materials', marketCap: 4.0e13 },
];

const FAKE_SHOCKS: Record<string, number> = { BBRI: -0.07, BMRI: -0.05 };
const FAKE_INDEX_MEMBERS: Record<string, string[]> = { IDXBUMN20: ['BBRI', 'BMRI', 'BBNI', 'TLKM', 'PTBA', 'ANTM'] };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const noise = (key: string, amplitude: number) => ((hash(key) % 2001) / 1000 - 1) * amplitude;

export function weekdaysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function series(symbol: string, start: string, end: string, today: string, shockDay: string | null): PricePoint[] {
  let p = 1000 + (hash(symbol) % 9000);
  return weekdaysBetween(start, end < today ? end : today).map((date, i) => {
    if (i > 0) {
      const shock = shockDay !== null && date === shockDay ? (FAKE_SHOCKS[symbol] ?? 0) : 0;
      p = p * (1 + noise(`${symbol}:${date}`, 0.004) + shock);
    }
    return { date, close: Math.round(p * 100) / 100 };
  });
}

export function createFakeMarketData(opts: { shockDay?: string | null; today?: string } = {}): MarketData {
  const today = () => opts.today ?? todayWib();
  const shockDay = opts.shockDay ?? null;
  return {
    today,
    universe: async () => FAKE_UNIVERSE,
    daily: async (symbol, start, end) => series(normalizeSymbol(symbol), start, end, today(), shockDay),
    ihsg: async (start, end) => series('IHSG', start, end, today(), null),
    foreignFlow: async (symbol, start, end) => {
      const s = normalizeSymbol(symbol);
      return weekdaysBetween(start, end < today() ? end : today()).map((date) => ({
        date,
        netForeignInflow: date === shockDay && FAKE_SHOCKS[s] ? -5e11 : Math.round(noise(`ff:${s}:${date}`, 1) * 1e10),
      }));
    },
    affiliates: async () => [],
    groupMembers: async () => [],
    indexMembers: async (code) => FAKE_INDEX_MEMBERS[code.toUpperCase()] ?? [],
    topLosers1d: async () => [],
  };
}

export function fakeNewsPage(today: string): NewsPage {
  return {
    articles: [
      {
        title: '(Contoh) Pemerintah kaji restrukturisasi bank BUMN',
        body: 'Contoh berita sintetis untuk pengembangan. Pemerintah dikabarkan mengkaji penggabungan beberapa bank BUMN.',
        source: 'https://example.com/contoh-berita-1',
        timestamp: `${today}T09:00:00`,
        sector: 'financials',
        sub_sector: ['banks'],
        tags: ['Politics & Regulation'],
        symbols: ['BBRI', 'BMRI'],
      },
      {
        title: '(Contoh) Harga batu bara acuan turun',
        body: 'Contoh berita sintetis untuk pengembangan tentang penurunan harga batu bara acuan.',
        source: 'https://example.com/contoh-berita-2',
        timestamp: `${today}T11:00:00`,
        sector: 'energy',
        sub_sector: ['oil-gas-coal'],
        tags: ['Commodity'],
        symbols: ['PTBA'],
      },
    ],
    hasNext: false,
    nextOffset: null,
  };
}
