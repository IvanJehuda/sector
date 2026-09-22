import type { AnalogSummary, Report } from '@/lib/domain';

export function findAnalogs(
  reports: Report[],
  eventType: string,
  subSectors: string[],
  excludeEventId?: string,
): AnalogSummary[] {
  const wanted = new Set(subSectors.map((s) => s.toLowerCase()));
  const acc = new Map<string, { subSector: string; cars: number[]; events: Set<string> }>();
  for (const r of reports) {
    if (r.mode !== 'retrospective' || r.eventType !== eventType || r.eventId === excludeEventId) continue;
    for (const f of r.findings) {
      const sub = f.candidate.subSector;
      if (!sub || !f.reaction || !wanted.has(sub.toLowerCase())) continue;
      const key = sub.toLowerCase();
      const entry = acc.get(key) ?? { subSector: sub, cars: [], events: new Set<string>() };
      entry.cars.push(f.reaction.car);
      entry.events.add(r.eventId);
      acc.set(key, entry);
    }
  }
  return [...acc.values()]
    .map((e) => ({
      subSector: e.subSector,
      eventCount: e.events.size,
      avgCar: e.cars.reduce((s, x) => s + x, 0) / e.cars.length,
    }))
    .sort((a, b) => b.eventCount - a.eventCount || a.subSector.localeCompare(b.subSector));
}
