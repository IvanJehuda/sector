import type { Candidate, Reaction, Report } from '@/lib/domain';

export function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    symbol: 'BBRI',
    name: 'PT Bank Rakyat Indonesia (Persero) Tbk',
    subSector: 'Banks',
    marketCap: 6e14,
    linkType: 'sector',
    reason: 'Subsektor Banks',
    withEvidence: true,
    ...overrides,
  };
}

export function makeReaction(overrides: Partial<Reaction> = {}): Reaction {
  return {
    t0: '2026-09-01',
    tEnd: '2026-09-08',
    days: 6,
    car: -0.05,
    marketReturn: -0.01,
    sigma: 0.01,
    zScore: -2.04,
    significant: true,
    ...overrides,
  };
}

export function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    eventId: 'evt-1',
    mode: 'retrospective',
    eventType: 'kebijakan',
    headline: 'Bagaimana pasar bereaksi terhadap berita ini',
    chain: ['Pemerintah mengumumkan kebijakan baru.'],
    market: { t0: '2026-09-01', ihsgReturn: -0.01, marketWide: false },
    findings: [
      {
        candidate: makeCandidate(),
        reaction: makeReaction(),
        netForeignInflow: -5e9,
        confidence: 'sedang',
        explanation: 'Penjelasan contoh.',
        dataNote: null,
      },
    ],
    subSectorSummary: [{ subSector: 'Banks', avgCar: -0.05, count: 1 }],
    otherLinks: [],
    unexplainedMovers: [],
    analogs: [],
    creditsUsed: 0,
    disclaimer: 'Disclaimer contoh.',
    createdAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  };
}
