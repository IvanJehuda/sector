import { llmFromEnv } from '@/lib/agent/from-env';
import { getDb } from '@/lib/db/client';
import { createFakeMarketData } from '@/lib/sectors/fake';
import { sectorsFromEnv } from '@/lib/sectors/from-env';
import { createSectorsMarketData } from '@/lib/sectors/market-data';
import { dbLedger } from '@/lib/sectors/stores';
import type { PipelineDeps } from './analyze';

export async function pipelineFromEnv(): Promise<PipelineDeps> {
  const db = await getDb();
  const market =
    process.env.SECTORS_MODE === 'fake'
      ? createFakeMarketData({ shockDay: process.env.FAKE_SHOCK_DAY || null })
      : createSectorsMarketData(sectorsFromEnv(db));
  return { db, market, llm: llmFromEnv(), ledger: dbLedger(db) };
}
