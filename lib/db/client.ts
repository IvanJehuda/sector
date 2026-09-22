import { createClient, type Client } from '@libsql/client';
import { migrate } from './migrate';

export type Db = Client;

export function createDb(
  url: string = process.env.DATABASE_URL ?? 'file:local.db',
  authToken: string | undefined = process.env.DATABASE_AUTH_TOKEN || undefined,
): Db {
  return createClient({ url, authToken });
}

let singleton: Promise<Db> | null = null;

/** Process-wide migrated database, configured from env. */
export function getDb(): Promise<Db> {
  if (!singleton) {
    singleton = (async () => {
      const db = createDb();
      await migrate(db);
      return db;
    })();
  }
  return singleton;
}
