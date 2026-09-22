import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ZodType } from 'zod';
import { canSpend, CreditBudgetError } from './budget';
import { cacheKey, canonicalQuery, fixtureFileName, type QueryParams } from './keys';
import type { CacheStore, CreditLedger } from './stores';

export type SectorsMode = 'fixture' | 'record' | 'live';

export class FixtureMissingError extends Error {
  constructor(
    public readonly key: string,
    public readonly file: string,
  ) {
    super(`No Sectors fixture for ${key} (expected ${file}). Record it with \`pnpm record\` or use SECTORS_MODE=fake.`);
    this.name = 'FixtureMissingError';
  }
}

export class SectorsHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    body: string,
  ) {
    super(`Sectors ${path} responded ${status}: ${body.slice(0, 200)}`);
    this.name = 'SectorsHttpError';
  }
}

export interface GetOptions {
  cost: number;
  /** null = never expires (historical data). */
  ttlSeconds: number | null;
}

export interface SectorsClient {
  get<T>(path: string, params: QueryParams, schema: ZodType<T>, opts: GetOptions): Promise<T>;
}

export interface SectorsClientOptions {
  mode: SectorsMode;
  apiKey?: string;
  baseUrl?: string;
  fixturesDir: string;
  cache: CacheStore;
  ledger: CreditLedger;
  budget: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_SERVER_RETRIES = 1;

export function createSectorsClient(o: SectorsClientOptions): SectorsClient {
  const baseUrl = o.baseUrl ?? 'https://api.sectors.app';
  const fetchImpl = o.fetchImpl ?? fetch;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = o.now ?? Date.now;

  async function readFixture(key: string): Promise<unknown> {
    const file = path.join(o.fixturesDir, fixtureFileName(key));
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      throw new FixtureMissingError(key, file);
    }
    return (JSON.parse(text) as { data: unknown }).data;
  }

  async function writeFixture(key: string, data: unknown): Promise<void> {
    await mkdir(o.fixturesDir, { recursive: true });
    await writeFile(path.join(o.fixturesDir, fixtureFileName(key)), JSON.stringify({ key, data }, null, 2));
  }

  async function fetchLive(p: string, params: QueryParams, cost: number): Promise<unknown> {
    const used = await o.ledger.total();
    if (!canSpend(used, cost, o.budget)) throw new CreditBudgetError(used, cost, o.budget);
    if (!o.apiKey) throw new Error('SECTORS_API_KEY is not set');
    const q = canonicalQuery(params);
    const url = `${baseUrl}${p}${q ? `?${q}` : ''}`;
    let rateLimitRetries = 0;
    let serverRetries = 0;
    for (;;) {
      const res = await fetchImpl(url, { headers: { Authorization: o.apiKey } });
      if (res.status === 429 && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
        await sleep(1000 * 2 ** rateLimitRetries);
        rateLimitRetries++;
        continue;
      }
      if (res.status >= 500 && serverRetries < MAX_SERVER_RETRIES) {
        serverRetries++;
        await sleep(1000);
        continue;
      }
      // Sectors bills 2xx and 404; 400/401/403/429/5xx are free.
      if (res.ok || res.status === 404) await o.ledger.record(p, cost);
      if (!res.ok) throw new SectorsHttpError(res.status, p, await res.text());
      return res.json();
    }
  }

  return {
    async get<T>(p: string, params: QueryParams, schema: ZodType<T>, opts: GetOptions): Promise<T> {
      const key = cacheKey(p, params);
      if (o.mode === 'fixture') return schema.parse(await readFixture(key));

      let raw: unknown;
      const cached = await o.cache.get(key, now());
      if (cached !== null) {
        raw = JSON.parse(cached);
      } else {
        raw = await fetchLive(p, params, opts.cost);
        const expiresAt = opts.ttlSeconds === null ? null : now() + opts.ttlSeconds * 1000;
        await o.cache.set(key, JSON.stringify(raw), expiresAt);
      }
      if (o.mode === 'record') await writeFixture(key, raw);
      return schema.parse(raw);
    },
  };
}
