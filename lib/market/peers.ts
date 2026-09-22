import type { StockFinding, SubSectorSummary } from '@/lib/domain';

export function summarizeSubSectors(findings: StockFinding[]): SubSectorSummary[] {
  const cars = new Map<string, number[]>();
  for (const f of findings) {
    if (!f.reaction || !f.candidate.subSector) continue;
    const list = cars.get(f.candidate.subSector) ?? [];
    list.push(f.reaction.car);
    cars.set(f.candidate.subSector, list);
  }
  return [...cars.entries()]
    .map(([subSector, list]) => ({
      subSector,
      count: list.length,
      avgCar: list.reduce((s, x) => s + x, 0) / list.length,
    }))
    .sort((a, b) => a.avgCar - b.avgCar);
}
