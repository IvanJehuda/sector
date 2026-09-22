import type { ZodType } from 'zod';

export type LinkType = 'direct' | 'group' | 'index' | 'sector';
export type EventSource = 'feed' | 'manual';
export type Mode = 'retrospective' | 'prospective';
export type Confidence = 'tinggi' | 'sedang' | 'rendah';
export type EventStatus = 'new' | 'analyzing' | 'done' | 'failed';

export interface EventInput {
  source: EventSource;
  url: string | null;
  title: string;
  body: string;
  /** ISO timestamp or YYYY-MM-DD. Strings without an offset are treated as WIB. */
  publishedAt: string;
  symbols: string[];
  tags: string[];
  subSectors: string[];
}

export interface StoredEvent extends EventInput {
  id: string;
  status: EventStatus;
  statusMessage: string | null;
  createdAt: string;
  /** When `status` last changed (ISO). Null for rows created before this column existed. */
  statusUpdatedAt: string | null;
}

/** An 'analyzing' status younger than this is treated as in flight; older ones may be re-claimed. */
export const ANALYSIS_STALE_MS = 180_000;

export interface Company {
  symbol: string;
  name: string;
  subSector: string | null;
  marketCap: number | null;
}

export interface PricePoint {
  date: string;
  close: number;
}

export interface FlowPoint {
  date: string;
  netForeignInflow: number;
}

export interface Mover {
  symbol: string;
  name: string;
  priceChange: number;
  date: string;
}

export interface Candidate {
  symbol: string;
  name: string;
  subSector: string | null;
  marketCap: number | null;
  linkType: LinkType;
  reason: string;
  withEvidence: boolean;
}

export interface Reaction {
  t0: string;
  tEnd: string;
  days: number;
  /** Cumulative abnormal return vs IHSG over [t0, tEnd]. */
  car: number;
  marketReturn: number;
  sigma: number;
  zScore: number;
  significant: boolean;
}

export interface StockFinding {
  candidate: Candidate;
  reaction: Reaction | null;
  netForeignInflow: number | null;
  confidence: Confidence;
  explanation: string;
  dataNote: string | null;
}

export interface AnalogSummary {
  subSector: string;
  eventCount: number;
  avgCar: number;
}

export interface SubSectorSummary {
  subSector: string;
  avgCar: number;
  count: number;
}

export interface Report {
  eventId: string;
  mode: Mode;
  eventType: string;
  headline: string;
  chain: string[];
  market: { t0: string; ihsgReturn: number; marketWide: boolean } | null;
  findings: StockFinding[];
  subSectorSummary: SubSectorSummary[];
  otherLinks: Candidate[];
  unexplainedMovers: Mover[];
  analogs: AnalogSummary[];
  creditsUsed: number;
  disclaimer: string;
  createdAt: string;
}

/** Market data the pipeline needs. Implemented by lib/sectors (real) and lib/sectors/fake.ts. */
export interface MarketData {
  today(): string;
  universe(): Promise<Company[]>;
  daily(symbol: string, start: string, end: string): Promise<PricePoint[]>;
  ihsg(start: string, end: string): Promise<PricePoint[]>;
  foreignFlow(symbol: string, start: string, end: string): Promise<FlowPoint[]>;
  affiliates(symbol: string): Promise<string[]>;
  groupMembers(group: string): Promise<string[]>;
  indexMembers(code: string): Promise<string[]>;
  topLosers1d(): Promise<Mover[]>;
}

/** Structured-output LLM call. Implemented by lib/agent/llm.ts (OpenAI and fake). */
export interface LlmClient {
  parse<T>(args: { schema: ZodType<T>; name: string; system: string; user: string }): Promise<T>;
}

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/\.JK$/, '');
}

export function todayWib(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}
