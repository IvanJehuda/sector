import { describe, expect, it } from 'vitest';
import { buildCandidates, directSymbols, simplifyName, uniqueSubSectors } from '@/lib/agent/candidates';
import type { EventProfile } from '@/lib/agent/profile';
import type { Company } from '@/lib/domain';

const universe: Company[] = [
  { symbol: 'BBRI', name: 'PT Bank Rakyat Indonesia (Persero) Tbk', subSector: 'Banks', marketCap: 6e14 },
  { symbol: 'BMRI', name: 'PT Bank Mandiri (Persero) Tbk', subSector: 'Banks', marketCap: 5e14 },
  { symbol: 'BBNI', name: 'PT Bank Negara Indonesia (Persero) Tbk', subSector: 'Banks', marketCap: 1.5e14 },
  { symbol: 'TLKM', name: 'PT Telkom Indonesia (Persero) Tbk', subSector: 'Telecommunication', marketCap: 3e14 },
  { symbol: 'ADRO', name: 'PT Alamtri Resources Indonesia Tbk', subSector: 'Coal', marketCap: 6e13 },
  { symbol: 'ANTM', name: 'PT Aneka Tambang Tbk', subSector: 'Metals', marketCap: 4e13 },
  { symbol: 'PTBA', name: 'PT Bukit Asam Tbk', subSector: 'Coal', marketCap: 3e13 },
];

function profile(overrides: Partial<EventProfile> = {}): EventProfile {
  return {
    summary: 's',
    event_type: 'kebijakan',
    themes: [],
    mentioned_companies: [],
    sub_sectors: [],
    index_hints: [],
    group_names: [],
    hypotheses: [],
    ...overrides,
  };
}

describe('helpers', () => {
  it('lists unique sub-sectors alphabetically', () => {
    expect(uniqueSubSectors(universe)).toEqual(['Banks', 'Coal', 'Metals', 'Telecommunication']);
  });
  it('simplifies company names', () => {
    expect(simplifyName('PT Bank Mandiri (Persero) Tbk')).toBe('bank mandiri');
  });
});

describe('directSymbols', () => {
  it('drops fictional symbols and matches companies by name', () => {
    const p = profile({
      mentioned_companies: [
        { name: 'Perusahaan Fiktif', symbol: 'ZZZZ' },
        { name: 'Bank Mandiri', symbol: null },
      ],
    });
    expect(directSymbols(p, ['bbri.jk', 'QQQQ'], universe)).toEqual(['BBRI', 'BMRI']);
  });
});

describe('buildCandidates', () => {
  it('orders by link priority, dedupes and ranks by market cap', () => {
    const { evidence, other } = buildCandidates({
      profile: profile({ sub_sectors: ['Coal'] }),
      sourceSymbols: ['BBRI'],
      universe,
      groupMembers: { Adaro: ['ADRO'] },
      indexMembers: { IDXBUMN20: ['PTBA', 'BBRI', 'ANTM', 'TLKM', 'BBNI'] },
    });
    expect(evidence.map((c) => [c.symbol, c.linkType])).toEqual([
      ['BBRI', 'direct'],
      ['ADRO', 'group'],
      ['TLKM', 'index'],
      ['BBNI', 'index'],
      ['ANTM', 'index'],
      ['PTBA', 'sector'],
    ]);
    expect(evidence.every((c) => c.withEvidence)).toBe(true);
    expect(other).toEqual([]);
    expect(evidence[1].reason).toBe('Satu grup usaha: Adaro');
  });

  it('moves candidates beyond six into other links', () => {
    const { evidence, other } = buildCandidates({
      profile: profile({ sub_sectors: ['Banks', 'Coal', 'Telecommunication'] }),
      sourceSymbols: ['ANTM', 'BBNI'],
      universe,
      groupMembers: {},
      indexMembers: {},
    });
    expect(evidence.map((c) => c.symbol)).toEqual(['ANTM', 'BBNI', 'BBRI', 'BMRI', 'ADRO', 'PTBA']);
    expect(other.map((c) => [c.symbol, c.withEvidence])).toEqual([['TLKM', false]]);
  });
});
