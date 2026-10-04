import { buildCandidates, directSymbols, MAX_GROUPS, uniqueSubSectors } from '@/lib/agent/candidates';
import { extractEventProfile, ProfileExtractionError, type EventProfile } from '@/lib/agent/profile';
import type { Db } from '@/lib/db/client';
import { getEvent, getReport, listRetrospectiveReports, saveReport, setEventStatus } from '@/lib/db/repo';
import type { Candidate, LlmClient, MarketData, Mode, Mover, PricePoint, Report, StockFinding } from '@/lib/domain';
import { scoreProspective, scoreRetrospective } from '@/lib/explain/confidence';
import { DISCLAIMER } from '@/lib/explain/guard';
import { toReportHypotheses } from '@/lib/explain/hypotheses';
import { narrate, type NarrationInput } from '@/lib/explain/narrate';
import { findAnalogs } from '@/lib/history/analogs';
import { eventCalendarDate, firstTradingDayOnOrAfter, priceWindow } from '@/lib/market/dates';
import { summarizeSubSectors } from '@/lib/market/peers';
import { isMarketWide, marketReturnOn, measureReaction, sumFlowBetween } from '@/lib/market/reaction';
import { CreditBudgetError } from '@/lib/sectors/budget';
import { FixtureMissingError, SectorsHttpError } from '@/lib/sectors/client';
import type { CreditLedger } from '@/lib/sectors/stores';

export interface PipelineDeps {
  db: Db;
  market: MarketData;
  llm: LlmClient;
  ledger: CreditLedger;
  now?: () => Date;
}

export const UNEXPLAINED_THRESHOLD = -0.05;
/** Only the first index hint is expanded, keeping an analysis within the advertised ~19 credits. */
export const MAX_INDEX_HINTS = 1;
const CREDIT_BLOCKED_NOTE = 'Data saham ini belum bisa diambil.';
const PROSPECTIVE_NOTE = 'Belum ada hari bursa setelah event, jadi ini hipotesis.';

export async function collectGroups(market: MarketData, profile: EventProfile, direct: string[]): Promise<Record<string, string[]>> {
  const names: string[] = [];
  for (const g of profile.group_names) if (!names.includes(g)) names.push(g);
  for (const s of direct.slice(0, 2)) {
    for (const g of await market.affiliates(s)) if (!names.includes(g)) names.push(g);
  }
  const out: Record<string, string[]> = {};
  for (const g of names.slice(0, MAX_GROUPS)) out[g] = await market.groupMembers(g);
  return out;
}

export async function collectIndexes(market: MarketData, profile: EventProfile): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const code of [...new Set(profile.index_hints)].slice(0, MAX_INDEX_HINTS)) out[code] = await market.indexMembers(code);
  return out;
}

async function measureCandidate(
  market: MarketData,
  c: Candidate,
  ihsg: PricePoint[],
  eventDay: string,
  win: { start: string; end: string },
  marketWide: boolean,
): Promise<StockFinding> {
  const empty = { candidate: c, reaction: null, netForeignInflow: null, confidence: 'rendah' as const, explanation: '' };
  let prices: PricePoint[];
  try {
    prices = await market.daily(c.symbol, win.start, win.end);
  } catch (err) {
    if (err instanceof SectorsHttpError) return { ...empty, dataNote: 'Data tidak tersedia dari Sectors.' };
    if (err instanceof CreditBudgetError) return { ...empty, dataNote: CREDIT_BLOCKED_NOTE };
    throw err;
  }
  const reaction = measureReaction(prices, ihsg, eventDay);
  if (!reaction) return { ...empty, dataNote: 'Data harga tidak cukup untuk mengukur reaksi.' };
  let netForeignInflow: number | null = null;
  try {
    netForeignInflow = sumFlowBetween(await market.foreignFlow(c.symbol, win.start, win.end), reaction.t0, reaction.tEnd);
  } catch (err) {
    if (err instanceof CreditBudgetError) {
      return { candidate: c, reaction, netForeignInflow: null, confidence: 'rendah', explanation: '', dataNote: CREDIT_BLOCKED_NOTE };
    }
    if (!(err instanceof SectorsHttpError)) throw err;
  }
  return {
    candidate: c,
    reaction,
    netForeignInflow,
    confidence: scoreRetrospective(c, reaction, marketWide),
    explanation: '',
    dataNote: null,
  };
}

function userMessage(err: unknown): string {
  if (err instanceof ProfileExtractionError) return 'Gagal memahami berita. Coba tempel teksnya atau ringkas beritanya.';
  if (err instanceof CreditBudgetError) return 'Data pasar sedang terbatas, jadi hanya data yang sudah tersimpan yang dipakai.';
  if (err instanceof FixtureMissingError) return 'Data contoh (fixture) untuk event ini belum direkam.';
  return 'Terjadi kesalahan saat menganalisis event.';
}

export async function analyzeEvent(eventId: string, deps: PipelineDeps): Promise<Report> {
  const { db, market, llm, ledger } = deps;
  const now = deps.now ?? (() => new Date());
  const existing = await getReport(db, eventId);
  if (existing) return existing;
  const event = await getEvent(db, eventId);
  if (!event) throw new Error(`Event ${eventId} not found`);
  const creditsBefore = await ledger.total();

  try {
    await setEventStatus(db, eventId, 'analyzing', 'Memahami berita…');
    const universe = await market.universe();
    const profile = await extractEventProfile(llm, event, uniqueSubSectors(universe));

    await setEventStatus(db, eventId, 'analyzing', 'Mencari saham terkait…');
    const direct = directSymbols(profile, event.symbols, universe);
    const groupMembers = await collectGroups(market, profile, direct);
    const indexMembers = await collectIndexes(market, profile);
    const { evidence, other } = buildCandidates({ profile, sourceSymbols: event.symbols, universe, groupMembers, indexMembers });

    await setEventStatus(db, eventId, 'analyzing', 'Mengecek reaksi harga…');
    const eventDay = eventCalendarDate(event.publishedAt);
    const win = priceWindow(eventDay, market.today());
    const ihsg = await market.ihsg(win.start, win.end);
    const tradingDays = ihsg.map((p) => p.date);
    const t0 = firstTradingDayOnOrAfter(tradingDays, eventDay);
    const mode: Mode = t0 ? 'retrospective' : 'prospective';
    const analogs = findAnalogs(await listRetrospectiveReports(db), profile.event_type, profile.sub_sectors, eventId);

    let marketInfo: Report['market'] = null;
    let findings: StockFinding[];
    let unexplainedMovers: Mover[] = [];
    if (t0) {
      const ihsgReturn = marketReturnOn(ihsg, t0) ?? 0;
      const marketWide = isMarketWide(ihsgReturn);
      marketInfo = { t0, ihsgReturn, marketWide };
      findings = [];
      for (const c of evidence) findings.push(await measureCandidate(market, c, ihsg, eventDay, win, marketWide));
      if (t0 === tradingDays[tradingDays.length - 1]) {
        const known = new Set([...evidence, ...other].map((c) => c.symbol));
        unexplainedMovers = (await market.topLosers1d()).filter((m) => m.priceChange <= UNEXPLAINED_THRESHOLD && !known.has(m.symbol));
      }
    } else {
      const analogCount = (sub: string | null) =>
        analogs.find((a) => sub !== null && a.subSector.toLowerCase() === sub.toLowerCase())?.eventCount ?? 0;
      findings = evidence.map((c) => ({
        candidate: c,
        reaction: null,
        netForeignInflow: null,
        confidence: scoreProspective(analogCount(c.subSector)),
        explanation: '',
        dataNote: PROSPECTIVE_NOTE,
      }));
    }

    await setEventStatus(db, eventId, 'analyzing', 'Menyusun penjelasan…');
    const narrationInput: NarrationInput = {
      mode,
      title: event.title,
      summary: profile.summary,
      ihsgReturn: marketInfo?.ihsgReturn ?? null,
      marketWide: marketInfo?.marketWide ?? false,
      findings: findings.map((f) => ({
        symbol: f.candidate.symbol,
        name: f.candidate.name,
        linkType: f.candidate.linkType,
        reason: f.candidate.reason,
        car: f.reaction?.car ?? null,
        significant: f.reaction?.significant ?? null,
        netForeignInflow: f.netForeignInflow,
        confidence: f.confidence,
      })),
      analogs,
    };
    const narrative = await narrate(llm, narrationInput);
    const explanationFor = new Map(narrative.explanations.map((e) => [e.symbol, e.text]));
    const finalFindings = findings.map((f) => ({ ...f, explanation: explanationFor.get(f.candidate.symbol) ?? '' }));

    const report: Report = {
      eventId,
      mode,
      eventType: profile.event_type,
      headline: narrative.headline,
      chain: narrative.chain,
      market: marketInfo,
      findings: finalFindings,
      subSectorSummary: summarizeSubSectors(finalFindings),
      otherLinks: other,
      unexplainedMovers,
      analogs,
      hypotheses: toReportHypotheses(profile.hypotheses),
      creditsUsed: (await ledger.total()) - creditsBefore,
      disclaimer: DISCLAIMER,
      createdAt: now().toISOString(),
    };
    await saveReport(db, report);
    await setEventStatus(db, eventId, 'done', null);
    return report;
  } catch (err) {
    await setEventStatus(db, eventId, 'failed', userMessage(err));
    throw err;
  }
}
