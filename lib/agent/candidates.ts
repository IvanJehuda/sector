import { normalizeSymbol, type Candidate, type Company, type LinkType } from '@/lib/domain';
import type { EventProfile } from './profile';

export const MAX_EVIDENCE = 6;
export const PER_GROUP = 3;
export const PER_INDEX = 4;
export const PER_SUBSECTOR = 2;
export const MAX_GROUPS = 2;
const MIN_NAME_MATCH_LENGTH = 4;

export function uniqueSubSectors(universe: Company[]): string[] {
  return [...new Set(universe.map((c) => c.subSector).filter((s): s is string => Boolean(s)))].sort();
}

export function simplifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(persero\)|\bpt\b|\btbk\b|[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function directSymbols(profile: EventProfile, sourceSymbols: string[], universe: Company[]): string[] {
  const known = new Set(universe.map((c) => c.symbol));
  const out: string[] = [];
  const push = (s: string) => {
    const n = normalizeSymbol(s);
    if (known.has(n) && !out.includes(n)) out.push(n);
  };
  sourceSymbols.forEach(push);
  for (const m of profile.mentioned_companies) {
    if (m.symbol && known.has(normalizeSymbol(m.symbol))) {
      push(m.symbol);
      continue;
    }
    const needle = simplifyName(m.name);
    if (needle.length < MIN_NAME_MATCH_LENGTH) continue;
    const hit = universe.find((c) => simplifyName(c.name).includes(needle));
    if (hit) push(hit.symbol);
  }
  return out;
}

export interface CandidateInputs {
  profile: EventProfile;
  sourceSymbols: string[];
  universe: Company[];
  groupMembers: Record<string, string[]>;
  indexMembers: Record<string, string[]>;
}

export function buildCandidates(i: CandidateInputs): { evidence: Candidate[]; other: Candidate[] } {
  const bySymbol = new Map(i.universe.map((c) => [c.symbol, c]));
  const list: Candidate[] = [];
  const add = (symbol: string, linkType: LinkType, reason: string) => {
    const n = normalizeSymbol(symbol);
    const company = bySymbol.get(n);
    if (!company || list.some((c) => c.symbol === n)) return;
    list.push({
      symbol: n,
      name: company.name,
      subSector: company.subSector,
      marketCap: company.marketCap,
      linkType,
      reason,
      withEvidence: false,
    });
  };
  const byMarketCap = (symbols: string[]) =>
    symbols
      .map(normalizeSymbol)
      .filter((s) => bySymbol.has(s))
      .sort((a, b) => (bySymbol.get(b)?.marketCap ?? 0) - (bySymbol.get(a)?.marketCap ?? 0));

  for (const s of directSymbols(i.profile, i.sourceSymbols, i.universe)) add(s, 'direct', 'Disebut langsung dalam berita');
  for (const [group, members] of Object.entries(i.groupMembers)) {
    for (const s of byMarketCap(members).slice(0, PER_GROUP)) add(s, 'group', `Satu grup usaha: ${group}`);
  }
  for (const [code, members] of Object.entries(i.indexMembers)) {
    for (const s of byMarketCap(members).slice(0, PER_INDEX)) add(s, 'index', `Anggota indeks ${code}`);
  }
  for (const sub of i.profile.sub_sectors) {
    const members = i.universe.filter((c) => c.subSector?.toLowerCase() === sub.toLowerCase()).map((c) => c.symbol);
    for (const s of byMarketCap(members).slice(0, PER_SUBSECTOR)) add(s, 'sector', `Subsektor ${sub}`);
  }

  return {
    evidence: list.slice(0, MAX_EVIDENCE).map((c) => ({ ...c, withEvidence: true })),
    other: list.slice(MAX_EVIDENCE),
  };
}
