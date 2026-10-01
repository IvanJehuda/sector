import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIN_MANUAL_TEXT } from '@/lib/events/manual';
import type { GoldenCase } from '@/lib/eval/score';

const ROOT = process.cwd();
const FIXTURES = path.join(ROOT, 'fixtures', 'sectors');

/** Sub-sector names exactly as the recorded Sectors universe spells them. */
function universeSubSectors(): Set<string> {
  const subs = new Set<string>();
  for (const file of readdirSync(FIXTURES).filter((f) => f.startsWith('v2_companies__'))) {
    const { data } = JSON.parse(readFileSync(path.join(FIXTURES, file), 'utf8')) as {
      data: { results?: Array<{ query_values?: { sub_sector?: string } }> };
    };
    for (const row of data.results ?? []) {
      const name = row.query_values?.sub_sector;
      if (name) subs.add(name);
    }
  }
  return subs;
}

/** Ticker symbols from the recorded universe, with the .JK suffix stripped. */
function universeSymbols(): Set<string> {
  const symbols = new Set<string>();
  for (const file of readdirSync(FIXTURES).filter((f) => f.startsWith('v2_companies__'))) {
    const { data } = JSON.parse(readFileSync(path.join(FIXTURES, file), 'utf8')) as {
      data: { results?: Array<{ symbol?: string }> };
    };
    for (const row of data.results ?? []) {
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

  it('gives every case a body long enough for manualEvent to accept', () => {
    const tooShort = cases.filter((c) => c.text.trim().length < MIN_MANUAL_TEXT).map((c) => c.title);
    expect(tooShort).toEqual([]);
  });

  it('dates every case as a real YYYY-MM-DD calendar date', () => {
    const bad = cases
      .filter((c) => !/^\d{4}-\d{2}-\d{2}$/.test(c.date) || new Date(`${c.date}T00:00:00Z`).toISOString().slice(0, 10) !== c.date)
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
