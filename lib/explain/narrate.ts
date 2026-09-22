import { z } from 'zod';
import { normalizeSymbol, type AnalogSummary, type Confidence, type LinkType, type LlmClient, type Mode } from '@/lib/domain';
import { formatIdrBillion, formatPct } from '@/lib/format';
import { findBannedPhrases } from './guard';

export const NARRATIVE_SCHEMA_NAME = 'narrative';

export const NarrativeSchema = z.object({
  headline: z.string(),
  chain: z.array(z.string()),
  explanations: z.array(z.object({ symbol: z.string(), text: z.string() })),
});

export type Narrative = z.infer<typeof NarrativeSchema>;

export interface NarrationFinding {
  symbol: string;
  name: string;
  linkType: LinkType;
  reason: string;
  car: number | null;
  significant: boolean | null;
  netForeignInflow: number | null;
  confidence: Confidence;
}

export interface NarrationInput {
  mode: Mode;
  title: string;
  summary: string;
  ihsgReturn: number | null;
  marketWide: boolean;
  findings: NarrationFinding[];
  analogs: AnalogSummary[];
}

const SYSTEM = [
  'Tulis penjelasan singkat berbahasa Indonesia untuk investor pemula, HANYA berdasarkan DATA JSON yang diberikan.',
  'Jangan menambah fakta atau angka di luar data. Angka persen tulis dengan koma desimal (contoh -7,2%).',
  'Dilarang memberi saran investasi dan dilarang memakai kata: beli, jual, rekomendasi, target harga, pasti naik, pasti turun, wajib, buy, sell, hold.',
  "Untuk foreign flow gunakan frasa persis 'net beli asing' atau 'net jual asing'.",
  'Kalau mode = prospective, tegaskan bahwa ini hipotesis karena belum ada hari bursa setelah event.',
  'Kalau marketWide = true, jelaskan bahwa pasar secara luas juga bergerak sehingga keterkaitannya lebih lemah.',
  'headline: satu kalimat. chain: 2–4 langkah sebab-akibat. explanations: satu per symbol, 1–2 kalimat.',
].join('\n');

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function explainFinding(f: NarrationFinding): string {
  const parts = [`${f.name} (${f.symbol}) terkait karena ${lowerFirst(f.reason)}.`];
  if (f.car === null) {
    parts.push('Data harga belum cukup untuk mengukur reaksi.');
  } else {
    parts.push(
      `Abnormal return kumulatif ${formatPct(f.car)} dibanding IHSG (${f.significant ? 'signifikan secara statistik' : 'masih dalam batas pergerakan normal'}).`,
    );
  }
  if (f.netForeignInflow !== null && f.netForeignInflow !== 0) {
    parts.push(
      `Investor asing mencatat ${f.netForeignInflow < 0 ? 'net jual asing' : 'net beli asing'} ${formatIdrBillion(f.netForeignInflow)} pada periode yang sama.`,
    );
  }
  return parts.join(' ');
}

export function templateNarrative(input: NarrationInput): Narrative {
  const headline =
    input.mode === 'retrospective'
      ? 'Bagaimana pasar bereaksi terhadap berita ini'
      : 'HIPOTESIS: saham yang berpotensi terkait dengan berita ini';
  const chain: string[] = [];
  if (findBannedPhrases(input.summary).length === 0) chain.push(input.summary);
  if (input.mode === 'retrospective' && input.ihsgReturn !== null) {
    chain.push(
      input.marketWide
        ? `IHSG bergerak ${formatPct(input.ihsgReturn)} pada hari event, jadi pergerakan pasar secara luas ikut berperan.`
        : `IHSG bergerak ${formatPct(input.ihsgReturn)} pada hari event, relatif stabil.`,
    );
  }
  if (input.mode === 'prospective') {
    chain.push('Belum ada hari bursa setelah event, jadi keterkaitan di bawah adalah hipotesis berdasarkan data historis.');
  }
  for (const a of input.analogs.slice(0, 2)) {
    chain.push(`Pada ${a.eventCount} event serupa sebelumnya, subsektor ${a.subSector} rata-rata bergerak ${formatPct(a.avgCar)} dibanding IHSG.`);
  }
  return { headline, chain, explanations: input.findings.map((f) => ({ symbol: f.symbol, text: explainFinding(f) })) };
}

const allText = (n: Narrative) => [n.headline, ...n.chain, ...n.explanations.map((e) => e.text)].join('\n');

export async function narrate(llm: LlmClient, input: NarrationInput): Promise<Narrative> {
  const fallback = templateNarrative(input);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const n = await llm.parse({
        schema: NarrativeSchema,
        name: NARRATIVE_SCHEMA_NAME,
        system: SYSTEM,
        user: JSON.stringify(input, null, 2),
      });
      if (findBannedPhrases(allText(n)).length > 0) continue;
      const bySymbol = new Map(n.explanations.map((e) => [normalizeSymbol(e.symbol), e.text]));
      const headline =
        input.mode === 'prospective' && !n.headline.toUpperCase().startsWith('HIPOTESIS') ? `HIPOTESIS: ${n.headline}` : n.headline;
      return {
        headline,
        chain: n.chain,
        explanations: fallback.explanations.map((e) => ({ symbol: e.symbol, text: bySymbol.get(e.symbol) ?? e.text })),
      };
    } catch {
      // try again, then fall back to the template
    }
  }
  return fallback;
}
