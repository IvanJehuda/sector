import type { Report } from '@/lib/domain';
import { IMPACT_LABEL, IMPACT_NOTE_AI, IMPACT_NOTE_PAST, IMPACT_TITLE, buildImpactRows, impactColumns, vsMarketPhrase } from '@/lib/ui/impact';
import { tone } from '@/lib/ui/present';

// Whole class names only: Tailwind never generates a class assembled from fragments.
const GRID = {
  'hyp-act': 'md:grid-cols-[150px_minmax(0,1fr)_200px_200px]',
  'hyp-pro': 'md:grid-cols-[150px_minmax(0,1fr)_220px]',
  'act-only': 'md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)]',
  'history-only': 'md:grid-cols-[150px_minmax(0,1fr)]',
} as const;

/** Per-sub-sector impact: the AI's hypothesis beside the measured reaction and similar past news. */
export function ImpactTable({ report }: { report: Report }) {
  const rows = buildImpactRows(report);
  const cols = impactColumns(rows, report.mode);
  const grid = `grid gap-x-4 gap-y-1.5 ${GRID[cols.hypothesis ? (cols.actual ? 'hyp-act' : 'hyp-pro') : cols.actual ? 'act-only' : 'history-only']}`;

  return (
    <section id="dampak" aria-labelledby="dampak-judul" className="flex flex-col gap-4">
      <h3 id="dampak-judul" className="text-[17px]">
        {IMPACT_TITLE}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-white/50">Belum ada data per bidang usaha.</p>
      ) : (
        <div className="border border-line">
          <div data-impact-header className={`${grid} hidden border-b border-line px-4 py-3 text-xs text-white/55 md:grid`} aria-hidden="true">
            <span>Bidang usaha</span>
            {cols.hypothesis && <span>Dugaan AI</span>}
            {cols.actual && <span>Kenyataan</span>}
            <span>Berita serupa sebelumnya</span>
          </div>
          {rows.map((r) => (
            <div key={r.subSector} className={`${grid} border-b border-line px-4 py-3.5 text-sm last:border-b-0`}>
              <span className="font-medium">{r.subSector}</span>
              {cols.hypothesis && (
                <span className="leading-relaxed text-white/80">
                  <span className="text-white/45 md:hidden">Dugaan AI: </span>
                  {r.hypothesis ? (
                    <>
                      <span className="mr-2 inline-block border border-dashed border-hypo/70 px-1.5 py-0.5 font-mono text-[11px] tracking-wide text-hypo">
                        {IMPACT_LABEL[r.hypothesis.direction].toUpperCase()}
                      </span>
                      {r.hypothesis.reason}
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              )}
              {cols.actual && (
                <span className={r.actual ? tone(r.actual.avgCar) : 'text-white/50'}>
                  <span className="text-white/45 md:hidden">Kenyataan: </span>
                  {r.actual ? `${vsMarketPhrase(r.actual.avgCar)} · ${r.actual.count} saham` : '—'}
                </span>
              )}
              <span className="text-white/75">
                <span className="text-white/45 md:hidden">Berita serupa: </span>
                {r.history ? (
                  <>
                    {r.history.eventCount} berita · rata-rata <span className={tone(r.history.avgCar)}>{vsMarketPhrase(r.history.avgCar)}</span>
                  </>
                ) : (
                  'Belum ada'
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-white/45">{cols.hypothesis ? `${IMPACT_NOTE_AI} ${IMPACT_NOTE_PAST}` : IMPACT_NOTE_PAST}</p>
    </section>
  );
}
