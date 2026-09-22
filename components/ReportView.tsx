'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Report, StoredEvent } from '@/lib/domain';
import { formatIdrBillion, formatPct } from '@/lib/format';
import { CONFIDENCE_LABEL, LINK_TYPE_LABEL, modeLabel } from '@/lib/ui/labels';
import { Disclaimer } from './Disclaimer';

export function ReportView({ event, report }: { event: StoredEvent; report: Report }) {
  const chartData = report.findings
    .filter((f) => f.reaction !== null)
    .map((f) => ({ symbol: f.candidate.symbol, car: Number(((f.reaction?.car ?? 0) * 100).toFixed(2)) }));

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
            report.mode === 'prospective' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
          }`}
        >
          {modeLabel(report.mode)}
        </span>
        <h1 className="text-2xl font-bold">{report.headline}</h1>
        <p className="text-sm text-gray-600">
          Berita:{' '}
          {event.url ? (
            <a href={event.url} target="_blank" rel="noreferrer" className="underline">
              {event.title}
            </a>
          ) : (
            event.title
          )}
        </p>
      </header>

      <Disclaimer />

      {report.market && (
        <section className="rounded-lg border p-4">
          <h2 className="font-semibold">Kondisi pasar</h2>
          <p>
            Hari bursa pertama setelah event: {report.market.t0}. IHSG {formatPct(report.market.ihsgReturn)} pada hari itu.
          </p>
          {report.market.marketWide && (
            <p className="text-amber-700">Pasar bergerak besar secara luas, jadi keterkaitan per saham lebih lemah.</p>
          )}
        </section>
      )}

      <section>
        <h2 className="font-semibold">Rantai sebab-akibat</h2>
        <ol className="list-decimal space-y-1 pl-5">
          {report.chain.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>

      {chartData.length > 0 && (
        <section>
          <h2 className="font-semibold">Abnormal return kumulatif dibanding IHSG (%)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="symbol" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="car">
                  {chartData.map((d) => (
                    <Cell key={d.symbol} fill={d.car < 0 ? '#dc2626' : '#16a34a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Saham terkait</h2>
        {report.findings.map((f) => (
          <div key={f.candidate.symbol} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                {f.candidate.symbol} · {f.candidate.name}
              </p>
              <span className="text-xs">{CONFIDENCE_LABEL[f.confidence]}</span>
            </div>
            <p className="text-xs text-gray-500">
              {LINK_TYPE_LABEL[f.candidate.linkType]}: {f.candidate.reason}
            </p>
            {f.reaction && (
              <p className="mt-1 text-sm">
                CAR {formatPct(f.reaction.car)} ({f.reaction.t0} s/d {f.reaction.tEnd}, z = {f.reaction.zScore.toFixed(1)}
                {f.reaction.significant ? ', signifikan' : ''})
                {f.netForeignInflow !== null && f.netForeignInflow !== 0
                  ? ` · ${f.netForeignInflow < 0 ? 'net jual asing' : 'net beli asing'} ${formatIdrBillion(f.netForeignInflow)}`
                  : ''}
              </p>
            )}
            <p className="mt-2">{f.explanation}</p>
            {f.dataNote && <p className="mt-1 text-xs text-gray-500">{f.dataNote}</p>}
          </div>
        ))}
      </section>

      {report.subSectorSummary.length > 0 && (
        <section>
          <h2 className="font-semibold">Ringkasan per subsektor</h2>
          <ul className="list-disc pl-5">
            {report.subSectorSummary.map((s) => (
              <li key={s.subSector}>
                {s.subSector}: rata-rata {formatPct(s.avgCar)} dibanding IHSG ({s.count} saham)
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-semibold">Pola historis</h2>
        {report.analogs.length > 0 ? (
          <ul className="list-disc pl-5">
            {report.analogs.map((a) => (
              <li key={a.subSector}>
                {a.subSector}: {a.eventCount} event serupa, rata-rata {formatPct(a.avgCar)} dibanding IHSG
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Belum ada preseden serupa di pustaka kami.</p>
        )}
      </section>

      {report.unexplainedMovers.length > 0 && (
        <section>
          <h2 className="font-semibold">Saham yang turun tajam tetapi belum terjelaskan</h2>
          <ul className="list-disc pl-5">
            {report.unexplainedMovers.map((m) => (
              <li key={m.symbol}>
                {m.symbol} · {m.name}: {formatPct(m.priceChange)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.otherLinks.length > 0 && (
        <section>
          <h2 className="font-semibold">Kaitan lain (tanpa bukti harga)</h2>
          <ul className="list-disc pl-5">
            {report.otherLinks.map((c) => (
              <li key={c.symbol}>
                {c.symbol} · {c.name} ({c.reason})
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="text-xs text-gray-500">
        Kredit Sectors terpakai untuk laporan ini: {report.creditsUsed}. Dibuat {report.createdAt.slice(0, 16).replace('T', ' ')} UTC.
      </footer>
    </article>
  );
}
