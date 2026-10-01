import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIN_MANUAL_TEXT } from '@/lib/events/manual';
import type { GoldenCase } from '@/lib/eval/score';

const ROOT = process.cwd();
const FIXTURES = path.join(ROOT, 'fixtures', 'sectors');

/** Paginated universe pages only — screener fixtures share the filename prefix but carry no offset. */
function universePages(): Array<{ results?: Array<{ symbol?: string; query_values?: { sub_sector?: string } }> }> {
  const pages = [];
  for (const file of readdirSync(FIXTURES).filter((f) => f.startsWith('v2_companies__'))) {
    const parsed = JSON.parse(readFileSync(path.join(FIXTURES, file), 'utf8')) as {
      key: string;
      data: { results?: Array<{ symbol?: string; query_values?: { sub_sector?: string } }> };
    };
    if (/offset=\d+/.test(parsed.key)) pages.push(parsed.data);
  }
  return pages;
}

/** Sub-sector names exactly as the recorded Sectors universe spells them. */
function universeSubSectors(): Set<string> {
  const subs = new Set<string>();
  for (const page of universePages()) {
    for (const row of page.results ?? []) {
      const name = row.query_values?.sub_sector;
      if (name) subs.add(name);
    }
  }
  return subs;
}

/** Ticker symbols from the recorded universe, with the .JK suffix stripped. */
function universeSymbols(): Set<string> {
  const symbols = new Set<string>();
  for (const page of universePages()) {
    for (const row of page.results ?? []) {
      if (row.symbol) symbols.add(row.symbol.replace(/\.JK$/, ''));
    }
  }
  return symbols;
}

const cases = JSON.parse(readFileSync(path.join(ROOT, 'data', 'golden-set.json'), 'utf8')) as GoldenCase[];

describe('golden set', () => {
  it('is a JSON array', () => {
    expect(Array.isArray(cases)).toBe(true);
  });

  it('gives every case the GoldenCase shape', () => {
    const bad = cases
      .map((c, i) => ({ label: typeof c?.title === 'string' ? c.title : `case #${i + 1}`, value: c }))
      .filter(
        ({ value }) =>
          typeof value?.title !== 'string' ||
          typeof value?.text !== 'string' ||
          typeof value?.date !== 'string' ||
          !Array.isArray(value?.expected_sub_sectors) ||
          !Array.isArray(value?.expected_symbols),
      )
      .map(({ label }) => label);
    expect(bad).toEqual([]);
  });

  it('holds 8 to 10 labelled events', () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
    expect(cases.length).toBeLessThanOrEqual(10);
  });

  it('spells every expected sub-sector exactly as the universe does', () => {
    const known = universeSubSectors();
    expect(known.size).toBeGreaterThan(0);
    const unknown = cases.flatMap((c) => c.expected_sub_sectors.filter((s) => !known.has(s)));
    expect(unknown).toEqual([]);
  });

  it('gives every case a body long enough for the extractor to work with', () => {
    const tooShort = cases.filter((c) => c.text.trim().length < MIN_MANUAL_TEXT).map((c) => c.title);
    expect(tooShort).toEqual([]);
  });

  it('dates every case as a real YYYY-MM-DD calendar date', () => {
    const bad = cases
      .filter((c) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date)) return true;
        const parsed = new Date(`${c.date}T00:00:00Z`);
        return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== c.date;
      })
      .map((c) => c.title);
    expect(bad).toEqual([]);
  });

  it('writes expected symbols as bare four-letter IDX tickers', () => {
    const bad = cases.flatMap((c) => c.expected_symbols.filter((s) => !/^[A-Z]{4}$/.test(s)));
    expect(bad).toEqual([]);
  });

  it('expects only symbols that exist in the recorded universe', () => {
    const known = universeSymbols();
    expect(known.size).toBeGreaterThan(0);
    const unknown = cases.flatMap((c) => c.expected_symbols.filter((s) => !known.has(s)));
    expect(unknown).toEqual([]);
  });

  it('expects at least one sub-sector and one symbol per case', () => {
    const empty = cases
      .filter((c) => c.expected_sub_sectors.length === 0 || c.expected_symbols.length === 0)
      .map((c) => c.title);
    expect(empty).toEqual([]);
  });

  it('lists no duplicates inside a case own expectations', () => {
    const dupes = cases
      .filter(
        (c) =>
          new Set(c.expected_sub_sectors).size !== c.expected_sub_sectors.length ||
          new Set(c.expected_symbols).size !== c.expected_symbols.length,
      )
      .map((c) => c.title);
    expect(dupes).toEqual([]);
  });

  it('has no duplicate titles', () => {
    expect(new Set(cases.map((c) => c.title)).size).toBe(cases.length);
  });
});
