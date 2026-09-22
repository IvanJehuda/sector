import { llmFromEnv } from '@/lib/agent/from-env';
import { getDb } from '@/lib/db/client';
import { todayWib } from '@/lib/domain';
import { fakeNewsSource, pollNews, sectorsNewsSource, type PollResult } from '@/lib/events/poll';
import { createFakeMarketData } from '@/lib/sectors/fake';
import { creditBudget, sectorsFromEnv } from '@/lib/sectors/from-env';
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

export async function pollFromEnv(): Promise<PollResult> {
  const db = await getDb();
  const today = todayWib();
  const source = process.env.SECTORS_MODE === 'fake' ? fakeNewsSource(today) : sectorsNewsSource(sectorsFromEnv(db));
  return pollNews({ db, source, ledger: dbLedger(db), budget: creditBudget(), today });
}
