import path from 'node:path';
import type { Db } from '@/lib/db/client';
import { createSectorsClient, type SectorsClient, type SectorsMode } from './client';
import { dbCache, dbLedger } from './stores';

const MODES: SectorsMode[] = ['fixture', 'record', 'live'];

export function creditBudget(): number {
  return Number(process.env.SECTORS_CREDIT_BUDGET ?? 1000);
}

export function sectorsFromEnv(db: Db): SectorsClient {
  const mode = (process.env.SECTORS_MODE ?? 'fixture') as SectorsMode;
  if (!MODES.includes(mode)) {
    throw new Error(`SECTORS_MODE must be one of ${MODES.join(', ')} for the real client (got ${mode})`);
  }
  return createSectorsClient({
    mode,
    apiKey: process.env.SECTORS_API_KEY,
    fixturesDir: path.join(process.cwd(), 'fixtures', 'sectors'),
    cache: dbCache(db),
    ledger: dbLedger(db),
    budget: creditBudget(),
  });
}
