import './env';
import { readFile } from 'node:fs/promises';
import { buildCandidates, directSymbols, uniqueSubSectors } from '@/lib/agent/candidates';
import { extractEventProfile } from '@/lib/agent/profile';
import { mean, precisionRecall, type GoldenCase } from '@/lib/eval/score';
import { manualEvent } from '@/lib/events/manual';
import { collectGroups, collectIndexes } from '@/lib/pipeline/analyze';
import { pipelineFromEnv } from '@/lib/pipeline/from-env';

async function main(): Promise<void> {
  const cases = JSON.parse(await readFile('data/golden-set.json', 'utf8')) as GoldenCase[];
  if (cases.length === 0) {
    console.log('data/golden-set.json masih kosong. Isi 8–10 event nyata (lihat README bagian "Golden set").');
    return;
  }
  const { market, llm } = await pipelineFromEnv();
  const universe = await market.universe();
  const rows: Array<{ event: string; subP: number; subR: number; symP: number; symR: number }> = [];
  for (const c of cases) {
    const event = manualEvent({ url: null, title: c.title, text: c.text, publishedAt: c.date });
    const profile = await extractEventProfile(llm, event, uniqueSubSectors(universe));
    const direct = directSymbols(profile, [], universe);
    const { evidence, other } = buildCandidates({
      profile,
      sourceSymbols: [],
      universe,
      groupMembers: await collectGroups(market, profile, direct),
      indexMembers: await collectIndexes(market, profile),
    });
    const sub = precisionRecall(c.expected_sub_sectors, profile.sub_sectors);
    const sym = precisionRecall(c.expected_symbols, [...evidence, ...other].map((x) => x.symbol));
    rows.push({ event: c.title.slice(0, 50), subP: sub.precision, subR: sub.recall, symP: sym.precision, symR: sym.recall });
  }
  console.table(rows);
  console.log(
    `Rata-rata subsektor: presisi ${mean(rows.map((r) => r.subP)).toFixed(2)}, recall ${mean(rows.map((r) => r.subR)).toFixed(2)}`,
  );
  console.log(`Rata-rata saham: presisi ${mean(rows.map((r) => r.symP)).toFixed(2)}, recall ${mean(rows.map((r) => r.symR)).toFixed(2)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
