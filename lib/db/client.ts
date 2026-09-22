import { createClient, type Client } from '@libsql/client';
import { migrate } from './migrate';

export type Db = Client;

export function createDb(
  url: string = process.env.DATABASE_URL ?? 'file:local.db',
  authToken: string | undefined = process.env.DATABASE_AUTH_TOKEN || undefined,
): Db {
  return createClient({ url, authToken });
}

/**
 * Memoizes an async database factory. A rejected initialisation (e.g. a failed
 * migration) is not cached, so the next call retries.
 */
export function memoizeDb(factory: () => Promise<Db>): () => Promise<Db> {
  let pending: Promise<Db> | null = null;
  return () => {
    if (!pending) {
      const attempt = factory();
      pending = attempt;
      attempt.catch(() => {
        if (pending === attempt) pending = null;
      });
    }
    return pending;
  };
}

/** Process-wide migrated database, configured from env. */
export const getDb: () => Promise<Db> = memoizeDb(async () => {
  const db = createDb();
  await migrate(db);
  return db;
});
