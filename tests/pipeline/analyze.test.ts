import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeLlm } from '@/lib/agent/llm';
import { ProfileExtractionError, type EventProfile } from '@/lib/agent/profile';
import { createDb, type Db } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import { getEvent, insertEvent } from '@/lib/db/repo';
import type { EventInput, LlmClient, MarketData } from '@/lib/domain';
import { DISCLAIMER } from '@/lib/explain/guard';
import type { NarrationInput } from '@/lib/explain/narrate';
import { analyzeEvent } from '@/lib/pipeline/analyze';
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

function fakeLlm(): LlmClient {
  return createFakeLlm({
    event_profile: PROFILE,
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
});
