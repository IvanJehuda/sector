import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import {
  CompanyOverviewSchema,
  DailySchema,
  ForeignFlowSchema,
  IndexDailySchema,
  NewsPageSchema,
  ScreenerSchema,
  TagsSchema,
  TopChangesSchema,
} from '@/lib/sectors/schemas';
import { loadSample } from '../helpers/fixtures';

const samples: Array<[string, ZodType<unknown>]> = [
  ['daily.json', DailySchema],
  ['index-daily.json', IndexDailySchema],
  ['foreign-flow.json', ForeignFlowSchema],
  ['screener.json', ScreenerSchema],
  ['company-report-overview.json', CompanyOverviewSchema],
  ['top-changes.json', TopChangesSchema],
  ['news.json', NewsPageSchema],
];

function schemaForKey(key: string): ZodType<unknown> | null {
  if (key.startsWith('/v2/daily/')) return DailySchema;
  if (key.startsWith('/v2/index-daily/')) return IndexDailySchema;
  if (key.startsWith('/v2/foreign-flow/')) return ForeignFlowSchema;
  if (key.startsWith('/v2/companies/top-changes/')) return TopChangesSchema;
  if (key.startsWith('/v2/companies/')) return ScreenerSchema;
  if (key.startsWith('/v2/company/report/')) return CompanyOverviewSchema;
  if (key.startsWith('/v2/news/')) return NewsPageSchema;
  if (key.startsWith('/v2/tags/')) return TagsSchema;
  return null;
}

describe('schemas accept documented samples', () => {
  it.each(samples)('%s', async (file, schema) => {
    const result = schema.safeParse(await loadSample(file));
    expect(result.success).toBe(true);
  });
});

describe('schemas accept every recorded fixture', () => {
  it('parses all files in fixtures/sectors (passes trivially before recording)', async () => {
    const dir = path.join(process.cwd(), 'fixtures', 'sectors');
    if (!existsSync(dir)) return;
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      const { key, data } = JSON.parse(await readFile(path.join(dir, f), 'utf8')) as { key: string; data: unknown };
      const schema = schemaForKey(key);
      expect(schema, `no schema mapped for ${key}`).not.toBeNull();
      const result = schema!.safeParse(data);
      expect(result.success, `${f} (${key}): ${result.success ? '' : result.error.message}`).toBe(true);
    }
  });
});
