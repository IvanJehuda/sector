import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSectorsClient } from '@/lib/sectors/client';
import { cacheKey, fixtureFileName, type QueryParams } from '@/lib/sectors/keys';
import { memoryCache, memoryLedger } from '@/lib/sectors/stores';

export async function tempFixtureClient() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sectors-fx-'));
  const client = createSectorsClient({
    mode: 'fixture',
    fixturesDir: dir,
    cache: memoryCache(),
    ledger: memoryLedger(),
    budget: 1000,
  });
  return { dir, client };
}

export async function putFixture(dir: string, pathName: string, params: QueryParams, data: unknown): Promise<void> {
  const key = cacheKey(pathName, params);
  await writeFile(path.join(dir, fixtureFileName(key)), JSON.stringify({ key, data }));
}

export async function loadSample(name: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(process.cwd(), 'fixtures', 'samples', name), 'utf8'));
}
