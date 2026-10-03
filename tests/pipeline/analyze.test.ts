import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeLlm } from '@/lib/agent/llm';
import { ProfileExtractionError, type EventProfile } from '@/lib/agent/profile';
import { createDb, type Db } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import { getEvent, insertEvent } from '@/lib/db/repo';
import type { EventInput, LlmClient, MarketData, Mover } from '@/lib/domain';
import { DISCLAIMER } from '@/lib/explain/guard';
import type { NarrationInput } from '@/lib/explain/narrate';
import { analyzeEvent } from '@/lib/pipeline/analyze';
import { CreditBudgetError } from '@/lib/sectors/budget';
import { SectorsHttpError } from '@/lib/sectors/client';
import { createFakeMarketData } from '@/lib/sectors/fake';
import { memoryLedger } from '@/lib/sectors/stores';

const PROFILE: EventProfile = {
  summary: 'Pemerintah mengumumkan kebijakan baru untuk bank BUMN.',
  event_type: 'kebijakan',
  themes: ['BUMN'],
  mentioned_companies: [{ name: 'Perusahaan Fiktif', symbol: 'ZZZZ' }],
  sub_sectors: ['Banks'],
  index_hints: ['IDXBUMN20'],
  group_names: [],
  hypotheses: [{ sub_sector: 'Banks', direction: 'negatif', reason: 'Uji.' }],
};

function fakeLlm(profile: EventProfile = PROFILE): LlmClient {
  return createFakeLlm({
    event_profile: profile,
    narrative: (user: string) => {
      const input = JSON.parse(user) as NarrationInput;
      return {
        headline: 'Saham bank BUMN tertekan',
        chain: ['Kebijakan diumumkan.', 'Saham bank BUMN bereaksi.'],
        explanations: input.findings.map((f) => ({ symbol: f.symbol, text: `Teks ${f.symbol}` })),
      };
    },
  });
}

const baseEvent: EventInput = {
  source: 'manual',
  url: null,
  title: 'Kebijakan bank BUMN',
  body: 'Isi berita uji. '.repeat(30),
  publishedAt: '2026-03-07T09:00:00',
  symbols: ['BBRI'],
  tags: [],
  subSectors: [],
};

let db: Db;
let market: MarketData;
beforeEach(async () => {
  db = createDb(':memory:');
  await migrate(db);
  market = createFakeMarketData({ shockDay: '2026-03-09', today: '2026-03-20' });
});

describe('analyzeEvent', () => {
  it('produces a retrospective report with evidence and saves it', async () => {
    const { event } = await insertEvent(db, baseEvent);
    const report = await analyzeEvent(event.id, { db, market, llm: fakeLlm(), ledger: memoryLedger() });

    expect(report.mode).toBe('retrospective');
    expect(report.market?.t0).toBe('2026-03-09');
    expect(report.market?.marketWide).toBe(false);
    const symbols = report.findings.map((f) => f.candidate.symbol);
    expect(symbols).not.toContain('ZZZZ');
    const bbri = report.findings.find((f) => f.candidate.symbol === 'BBRI')!;
    expect(bbri.candidate.linkType).toBe('direct');
    expect(bbri.reaction?.significant).toBe(true);
    expect(bbri.confidence).toBe('tinggi');
    expect(bbri.netForeignInflow).toBeLessThan(0);
    expect(bbri.explanation).toBe('Teks BBRI');
    const bmri = report.findings.find((f) => f.candidate.symbol === 'BMRI')!;
    expect(bmri.candidate.linkType).toBe('index');
    expect(bmri.confidence).toBe('sedang');
    expect(report.subSectorSummary.find((s) => s.subSector === 'Banks')).toBeDefined();
    expect(report.disclaimer).toBe(DISCLAIMER);
    expect(report.unexplainedMovers).toEqual([]);
    expect((await getEvent(db, event.id))?.status).toBe('done');
  });

  it('returns the stored report without touching market data again', async () => {
    const { event } = await insertEvent(db, baseEvent);
    const deps = { db, market, llm: fakeLlm(), ledger: memoryLedger() };
    const first = await analyzeEvent(event.id, deps);
    const spy = vi.spyOn(market, 'universe');
    expect(await analyzeEvent(event.id, deps)).toEqual(first);
    expect(spy).not.toHaveBeenCalled();
  });

  it('produces a prospective hypothesis with analogs for a future event', async () => {
    const deps = { db, market, llm: fakeLlm(), ledger: memoryLedger() };
    const past = await insertEvent(db, baseEvent);
    await analyzeEvent(past.event.id, deps);
    const future = await insertEvent(db, { ...baseEvent, publishedAt: '2026-03-25T09:00:00' });
    const report = await analyzeEvent(future.event.id, deps);

    expect(report.mode).toBe('prospective');
    expect(report.market).toBeNull();
    expect(report.headline.startsWith('HIPOTESIS')).toBe(true);
    expect(report.findings.every((f) => f.reaction === null && f.confidence !== 'tinggi')).toBe(true);
    expect(report.analogs).toEqual([expect.objectContaining({ subSector: 'Banks', eventCount: 1 })]);
  });

  it('marks the event failed with a user message when extraction fails', async () => {
    const { event } = await insertEvent(db, baseEvent);
    const llm = createFakeLlm({ event_profile: { broken: true } });
    await expect(analyzeEvent(event.id, { db, market, llm, ledger: memoryLedger() })).rejects.toBeInstanceOf(ProfileExtractionError);
    const stored = await getEvent(db, event.id);
    expect(stored?.status).toBe('failed');
    expect(stored?.statusMessage).toContain('Gagal memahami berita');
  });

  it('degrades gracefully when one stock fails at Sectors, keeping the rest of the report', async () => {
    const base = createFakeMarketData({ shockDay: '2026-03-09', today: '2026-03-20' });
    const degraded: MarketData = {
      ...base,
      daily: async (s, a, b) => {
        if (s === 'TLKM') throw new SectorsHttpError(503, '/v2/daily/TLKM/', 'down');
        return base.daily(s, a, b);
      },
    };
    const { event } = await insertEvent(db, baseEvent);
    const report = await analyzeEvent(event.id, { db, market: degraded, llm: fakeLlm(), ledger: memoryLedger() });

    expect(report.mode).toBe('retrospective');
    expect((await getEvent(db, event.id))?.status).toBe('done');
    const tlkm = report.findings.find((f) => f.candidate.symbol === 'TLKM')!;
    expect(tlkm.reaction).toBeNull();
    expect(tlkm.confidence).toBe('rendah');
    expect(tlkm.dataNote).toBe('Data tidak tersedia dari Sectors.');
    const bbri = report.findings.find((f) => f.candidate.symbol === 'BBRI')!;
    expect(bbri.reaction?.significant).toBe(true);
  });

  it('degrades per stock when the credit budget blocks price or flow data', async () => {
    const base = createFakeMarketData({ shockDay: '2026-03-09', today: '2026-03-20' });
    const blocked: MarketData = {
      ...base,
      daily: async (s, a, b) => {
        if (s === 'TLKM') throw new CreditBudgetError(900, 1, 1000);
        return base.daily(s, a, b);
      },
      foreignFlow: async (s, a, b) => {
        if (s === 'BMRI') throw new CreditBudgetError(900, 1, 1000);
        return base.foreignFlow(s, a, b);
      },
    };
    const { event } = await insertEvent(db, baseEvent);
    const report = await analyzeEvent(event.id, { db, market: blocked, llm: fakeLlm(), ledger: memoryLedger() });

    expect((await getEvent(db, event.id))?.status).toBe('done');
    const note = 'Data saham ini belum bisa diambil.';
    const tlkm = report.findings.find((f) => f.candidate.symbol === 'TLKM')!;
    expect(tlkm).toMatchObject({ reaction: null, netForeignInflow: null, confidence: 'rendah', dataNote: note });
    const bmri = report.findings.find((f) => f.candidate.symbol === 'BMRI')!;
    expect(bmri.reaction).not.toBeNull();
    expect(bmri).toMatchObject({ netForeignInflow: null, confidence: 'rendah', dataNote: note });
    const bbri = report.findings.find((f) => f.candidate.symbol === 'BBRI')!;
    expect(bbri.reaction?.significant).toBe(true);
    expect(bbri.dataNote).toBeNull();
  });

  it('still fails the analysis when the credit budget blocks the IHSG series', async () => {
    const base = createFakeMarketData({ shockDay: '2026-03-09', today: '2026-03-20' });
    const blocked: MarketData = {
      ...base,
      ihsg: async () => {
        throw new CreditBudgetError(900, 1, 1000);
      },
    };
    const { event } = await insertEvent(db, baseEvent);
    await expect(analyzeEvent(event.id, { db, market: blocked, llm: fakeLlm(), ledger: memoryLedger() })).rejects.toBeInstanceOf(
      CreditBudgetError,
    );
    expect(await getEvent(db, event.id)).toMatchObject({
      status: 'failed',
      statusMessage: 'Data pasar sedang terbatas, jadi hanya data yang sudah tersimpan yang dipakai.',
    });
  });

  it('fetches members for the first index hint only', async () => {
    const base = createFakeMarketData({ shockDay: '2026-03-09', today: '2026-03-20' });
    const indexMembers = vi.fn(base.indexMembers);
    const { event } = await insertEvent(db, baseEvent);
    await analyzeEvent(event.id, {
      db,
      market: { ...base, indexMembers },
      llm: fakeLlm({ ...PROFILE, index_hints: ['IDXBUMN20', 'LQ45', 'IDXBUMN20'] }),
      ledger: memoryLedger(),
    });
    expect(indexMembers).toHaveBeenCalledTimes(1);
    expect(indexMembers).toHaveBeenCalledWith('IDXBUMN20');
  });

  it('flags unexplained movers only when t0 is the last trading day', async () => {
    const base = createFakeMarketData({ shockDay: '2026-03-09', today: '2026-03-09' });
    const movers: Mover[] = [
      { symbol: 'BBRI', name: 'PT Bank Rakyat Indonesia (Persero) Tbk', priceChange: -0.07, date: '2026-03-09' },
      { symbol: 'ADRO', name: 'PT Alamtri Resources Indonesia Tbk', priceChange: -0.08, date: '2026-03-09' },
      { symbol: 'PTBA', name: 'PT Bukit Asam Tbk', priceChange: -0.03, date: '2026-03-09' },
    ];
    const withMovers: MarketData = { ...base, topLosers1d: async () => movers };
    const { event } = await insertEvent(db, baseEvent);
    const report = await analyzeEvent(event.id, { db, market: withMovers, llm: fakeLlm(), ledger: memoryLedger() });

    expect(report.market?.t0).toBe('2026-03-09');
    expect(report.unexplainedMovers).toEqual([movers[1]]);
  });
});
