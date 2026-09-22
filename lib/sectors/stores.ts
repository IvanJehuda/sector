import type { Db } from '@/lib/db/client';

export interface CacheStore {
  get(key: string, now: number): Promise<string | null>;
  set(key: string, body: string, expiresAt: number | null): Promise<void>;
}

export interface CreditLedger {
  total(): Promise<number>;
  record(path: string, cost: number): Promise<void>;
}

export function memoryCache(): CacheStore {
  const entries = new Map<string, { body: string; expiresAt: number | null }>();
  return {
    async get(key, now) {
      const e = entries.get(key);
      if (!e) return null;
      if (e.expiresAt !== null && e.expiresAt <= now) return null;
      return e.body;
    },
    async set(key, body, expiresAt) {
      entries.set(key, { body, expiresAt });
    },
  };
}

export function memoryLedger(initial = 0): CreditLedger {
  let total = initial;
  return {
    async total() {
      return total;
    },
    async record(_path, cost) {
      total += cost;
    },
  };
}

export function dbCache(db: Db): CacheStore {
  return {
    async get(key, now) {
      const r = await db.execute({ sql: 'SELECT body, expires_at FROM api_cache WHERE key = ?', args: [key] });
      const row = r.rows[0];
      if (!row) return null;
      const expiresAt = row.expires_at === null ? null : Number(row.expires_at);
      if (expiresAt !== null && expiresAt <= now) return null;
      return String(row.body);
    },
    async set(key, body, expiresAt) {
      await db.execute({
        sql: 'INSERT OR REPLACE INTO api_cache (key, body, expires_at) VALUES (?, ?, ?)',
        args: [key, body, expiresAt],
      });
    },
  };
}

export function dbLedger(db: Db): CreditLedger {
  return {
    async total() {
      const r = await db.execute('SELECT COALESCE(SUM(cost), 0) AS total FROM credit_ledger');
      return Number(r.rows[0]?.total ?? 0);
    },
    async record(path, cost) {
      await db.execute({
        sql: 'INSERT INTO credit_ledger (at, path, cost) VALUES (?, ?, ?)',
        args: [new Date().toISOString(), path, cost],
      });
    },
  };
}
