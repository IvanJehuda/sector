import { describe, expect, it } from 'vitest';
import { createDb } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import { dbCache, dbLedger, memoryCache, memoryLedger, type CacheStore, type CreditLedger } from '@/lib/sectors/stores';

async function freshDb() {
  const db = createDb(':memory:');
  await migrate(db);
  return db;
}

const caches: Array<[string, () => Promise<CacheStore>]> = [
  ['memory', async () => memoryCache()],
  ['db', async () => dbCache(await freshDb())],
];
const ledgers: Array<[string, () => Promise<CreditLedger>]> = [
  ['memory', async () => memoryLedger()],
  ['db', async () => dbLedger(await freshDb())],
];

describe.each(caches)('%s cache', (_name, make) => {
  it('returns stored bodies until they expire', async () => {
    const cache = await make();
    await cache.set('k', 'body', 1_000);
    expect(await cache.get('k', 999)).toBe('body');
    expect(await cache.get('k', 1_000)).toBeNull();
  });
  it('keeps entries without expiry forever', async () => {
    const cache = await make();
    await cache.set('k', 'body', null);
    expect(await cache.get('k', Number.MAX_SAFE_INTEGER)).toBe('body');
    expect(await cache.get('missing', 0)).toBeNull();
  });
});

describe.each(ledgers)('%s ledger', (_name, make) => {
  it('sums recorded costs', async () => {
    const ledger = await make();
    expect(await ledger.total()).toBe(0);
    await ledger.record('/v2/daily/BBCA/', 1);
    await ledger.record('/v2/companies/top-changes/', 2);
    expect(await ledger.total()).toBe(3);
  });
});
