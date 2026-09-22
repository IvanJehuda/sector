export interface GoldenCase {
  title: string;
  text: string;
  date: string;
  expected_sub_sectors: string[];
  expected_symbols: string[];
}

export function precisionRecall(expected: string[], actual: string[]): { precision: number; recall: number } {
  const e = new Set(expected.map((x) => x.toLowerCase()));
  const a = new Set(actual.map((x) => x.toLowerCase()));
  const hits = [...a].filter((x) => e.has(x)).length;
  return {
    precision: a.size > 0 ? hits / a.size : e.size === 0 ? 1 : 0,
    recall: e.size > 0 ? hits / e.size : 1,
  };
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}
