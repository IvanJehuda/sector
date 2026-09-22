import './env';
import path from 'node:path';
import { createDb } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import { todayWib } from '@/lib/domain';
import { addDays, eventCalendarDate, priceWindow } from '@/lib/market/dates';
import { createSectorsClient } from '@/lib/sectors/client';
import { fetchNewsPage } from '@/lib/sectors/endpoints';
import { creditBudget } from '@/lib/sectors/from-env';
import { createSectorsMarketData } from '@/lib/sectors/market-data';
import { TagsSchema } from '@/lib/sectors/schemas';
import { dbCache, dbLedger } from '@/lib/sectors/stores';

// Default: IDX trading-halt day (18 Mar 2025). Override: pnpm record 2026-08-12
const EVENT_DATE = process.argv[2] ?? '2025-03-18';
const SYMBOLS = ['BBRI', 'BMRI', 'TLKM'];

async function main(): Promise<void> {
  if (!process.env.SECTORS_API_KEY) throw new Error('Isi SECTORS_API_KEY di .env.local dulu');
  const db = createDb();
  await migrate(db);
  const ledger = dbLedger(db);
  const client = createSectorsClient({
    mode: 'record',
    apiKey: process.env.SECTORS_API_KEY,
    fixturesDir: path.join(process.cwd(), 'fixtures', 'sectors'),
    cache: dbCache(db),
    ledger,
    budget: creditBudget(),
  });
  const market = createSectorsMarketData(client);
  const before = await ledger.total();
  const today = todayWib();
  const eventDay = eventCalendarDate(EVENT_DATE);
  const win = priceWindow(eventDay, today);
  console.log(`Merekam fixture untuk event ${eventDay}, jendela ${win.start} s/d ${win.end}`);

  const universe = await market.universe();
  console.log(`Universe: ${universe.length} emiten`);
  await market.ihsg(win.start, win.end);
  for (const s of SYMBOLS) {
    await market.daily(s, win.start, win.end);
    await market.foreignFlow(s, win.start, win.end);
  }
  const affiliates = await market.affiliates('BBRI');
  console.log(`Afiliasi BBRI: ${affiliates.join(', ') || '(kosong)'}`);
  if (affiliates[0]) console.log(`Anggota grup ${affiliates[0]}: ${(await market.groupMembers(affiliates[0])).join(', ')}`);
  console.log(`Anggota IDXBUMN20: ${(await market.indexMembers('IDXBUMN20')).join(', ')}`);
  await market.topLosers1d();
  await fetchNewsPage(client, { start: addDays(today, -2), offset: 0 });
  const tags = await client.get('/v2/tags/', {}, TagsSchema, { cost: 1, ttlSeconds: 7 * 86_400 });
  console.log(`Tag berita (${tags.length}): ${tags.join(', ')}`);

  const missing = universe.filter((c) => c.subSector === null).length;
  if (universe.length === 0 || missing > universe.length / 2) {
    console.warn(
      'PERINGATAN: query_values screener tidak memuat sub_sector. Buka fixture v2_companies_*.json, ' +
        'lihat field yang tersedia, lalu sesuaikan UNIVERSE_WHERE/fetchUniverse (spec §4).',
    );
  }
  console.log(`Selesai. Kredit terpakai: ${(await ledger.total()) - before}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
