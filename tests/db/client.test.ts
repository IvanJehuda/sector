import { describe, expect, it, vi } from 'vitest';
import { createDb, memoizeDb, type Db } from '@/lib/db/client';

describe('memoizeDb', () => {
  it('shares one database across calls', async () => {
    const db = createDb(':memory:');
    const factory = vi.fn(async (): Promise<Db> => db);
    const get = memoizeDb(factory);
    expect(await Promise.all([get(), get()])).toEqual([db, db]);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed initialisation instead of caching the rejection', async () => {
    const db = createDb(':memory:');
    const factory = vi
      .fn<() => Promise<Db>>()
      .mockRejectedValueOnce(new Error('migration failed'))
      .mockResolvedValue(db);
    const get = memoizeDb(factory);
    await expect(get()).rejects.toThrow('migration failed');
    expect(await get()).toBe(db);
    expect(await get()).toBe(db);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
