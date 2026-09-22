import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CreditBudgetError } from '@/lib/sectors/budget';
import { createSectorsClient, FixtureMissingError, SectorsHttpError, type SectorsMode } from '@/lib/sectors/client';
import { cacheKey, fixtureFileName } from '@/lib/sectors/keys';
import { memoryCache, memoryLedger } from '@/lib/sectors/stores';

const Schema = z.object({ ok: z.boolean() });
const OPTS = { cost: 1, ttlSeconds: 60 };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function setup(mode: SectorsMode, opts: { ledgerStart?: number; now?: () => number } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sectors-fx-'));
  const ledger = memoryLedger(opts.ledgerStart ?? 0);
  const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => json({ ok: true }));
  const client = createSectorsClient({
    mode,
    apiKey: 'test-key',
    fixturesDir: dir,
    cache: memoryCache(),
    ledger,
    budget: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep: async () => {},
    now: opts.now,
  });
  return { dir, ledger, fetchImpl, client };
}

describe('fixture mode', () => {
  it('reads the fixture file and never calls fetch', async () => {
    const { dir, fetchImpl, client } = await setup('fixture');
    const key = cacheKey('/v2/x/', { a: 1 });
    await writeFile(path.join(dir, fixtureFileName(key)), JSON.stringify({ key, data: { ok: true } }));
    expect(await client.get('/v2/x/', { a: 1 }, Schema, OPTS)).toEqual({ ok: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws FixtureMissingError when no fixture exists', async () => {
    const { client } = await setup('fixture');
    await expect(client.get('/v2/x/', {}, Schema, OPTS)).rejects.toBeInstanceOf(FixtureMissingError);
  });
});

describe('live mode', () => {
  it('fetches with the API key, records the cost and caches the result', async () => {
    const { fetchImpl, ledger, client } = await setup('live');
    await client.get('/v2/x/', { a: 1 }, Schema, OPTS);
    await client.get('/v2/x/', { a: 1 }, Schema, OPTS);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.sectors.app/v2/x/?a=1', {
      headers: { Authorization: 'test-key' },
    });
    expect(await ledger.total()).toBe(1);
  });

  it('refetches after the cache entry expires', async () => {
    let t = 0;
    const { fetchImpl, client } = await setup('live', { now: () => t });
    await client.get('/v2/x/', {}, Schema, OPTS);
    t = 61_000;
    await client.get('/v2/x/', {}, Schema, OPTS);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries 429 and charges once', async () => {
    const { fetchImpl, ledger, client } = await setup('live');
    fetchImpl
      .mockImplementationOnce(async () => json({ error: 'RATE_LIMIT_EXCEEDED' }, 429))
      .mockImplementationOnce(async () => json({ error: 'RATE_LIMIT_EXCEEDED' }, 429));
    expect(await client.get('/v2/x/', {}, Schema, OPTS)).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(await ledger.total()).toBe(1);
  });

  it('retries a 5xx once', async () => {
    const { fetchImpl, client } = await setup('live');
    fetchImpl.mockImplementationOnce(async () => json({ error: 'boom' }, 503));
    expect(await client.get('/v2/x/', {}, Schema, OPTS)).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not charge for 400', async () => {
    const { fetchImpl, ledger, client } = await setup('live');
    fetchImpl.mockImplementationOnce(async () => json({ error: 'bad' }, 400));
    await expect(client.get('/v2/x/', {}, Schema, OPTS)).rejects.toBeInstanceOf(SectorsHttpError);
    expect(await ledger.total()).toBe(0);
  });

  it('charges for 404', async () => {
    const { fetchImpl, ledger, client } = await setup('live');
    fetchImpl.mockImplementationOnce(async () => json({ error: 'nope' }, 404));
    await expect(client.get('/v2/x/', {}, Schema, OPTS)).rejects.toMatchObject({ status: 404 });
    expect(await ledger.total()).toBe(1);
  });

  it('blocks calls past 90% of the budget without fetching', async () => {
    const { fetchImpl, client } = await setup('live', { ledgerStart: 900 });
    await expect(client.get('/v2/x/', {}, Schema, OPTS)).rejects.toBeInstanceOf(CreditBudgetError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('record mode', () => {
  it('writes a fixture file for the response', async () => {
    const { dir, client } = await setup('record');
    await client.get('/v2/x/', { a: 1 }, Schema, OPTS);
    expect(await readdir(dir)).toContain(fixtureFileName(cacheKey('/v2/x/', { a: 1 })));
  });
});
