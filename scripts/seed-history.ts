import './env';
import { insertEvent } from '@/lib/db/repo';
import { todayWib } from '@/lib/domain';
import { newsToEvent } from '@/lib/events/news';
import { addDays, eventCalendarDate } from '@/lib/market/dates';
import { analyzeEvent } from '@/lib/pipeline/analyze';
import { pipelineFromEnv } from '@/lib/pipeline/from-env';
import { fetchNewsPage } from '@/lib/sectors/endpoints';
import { sectorsFromEnv } from '@/lib/sectors/from-env';

const MAX_PAGES = 5;
/** Only events old enough for the full post-event window (t0..t0+5 trading days). */
const SETTLE_DAYS = 8;

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : fallback;
  if (value === undefined) throw new Error(`Argumen --${name} wajib diisi`);
  return value;
}

async function main(): Promise<void> {
  if (process.env.SECTORS_MODE !== 'live') throw new Error('Jalankan dengan SECTORS_MODE=live (script ini memakai kredit asli).');
  const tag = arg('tag');
  const since = arg('since');
  const limit = Number(arg('limit', '15'));
  const deps = await pipelineFromEnv();
  const client = sectorsFromEnv(deps.db);
  const cutoff = addDays(todayWib(), -SETTLE_DAYS);
  const before = await deps.ledger.total();

  let offset = 0;
  let done = 0;
  for (let page = 0; page < MAX_PAGES && done < limit; page++) {
    const res = await fetchNewsPage(client, { start: since, offset, tags: tag });
    for (const article of res.articles) {
      if (done >= limit) break;
      if (eventCalendarDate(article.timestamp) > cutoff) continue;
      const { event } = await insertEvent(deps.db, newsToEvent(article));
      try {
        const report = await analyzeEvent(event.id, deps);
        done++;
        console.log(`OK  ${article.title.slice(0, 70)} | ${report.mode} | ${report.findings.length} saham | ${report.creditsUsed} kredit`);
      } catch (err) {
        console.error(`ERR ${article.title.slice(0, 70)} | ${(err as Error).message}`);
      }
    }
    if (!res.hasNext || res.nextOffset === null) break;
    offset = res.nextOffset;
  }
  console.log(`Selesai: ${done} event. Total kredit: ${(await deps.ledger.total()) - before}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
