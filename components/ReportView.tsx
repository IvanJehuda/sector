import type { Report, StockFinding, StoredEvent } from '@/lib/domain';
import { formatPct } from '@/lib/format';
import { CONFIDENCE_LABEL, LINK_TYPE_LABEL, modeLabel } from '@/lib/ui/labels';
import { SHORT_DISCLAIMER, describeVsMarket, foreignFlowText, formatDateId, unusualLabel } from '@/lib/ui/present';

const EVIDENCE_TAG = {
  tinggi: 'border-up/45 text-up',
  sedang: 'border-warn/45 text-warn',
  rendah: 'border-line-strong text-white/60',
} as const;

const CREATED_AT = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' });

const tone = (x: number) => (x < 0 ? 'text-down' : x > 0 ? 'text-up' : '');

function marketText(ihsg: number) {
  const s = formatPct(Math.abs(ihsg)).replace('+', '');
  return ihsg < 0 ? `Turun ${s}` : ihsg > 0 ? `Naik ${s}` : 'Tidak berubah';
}

function Kpi({ label, value, tech }: { label: string; value: React.ReactNode; tech: string }) {
  return (
    <div className="flex flex-col gap-1.5 border-line py-5 transition-colors md:px-6 md:first:pl-0 hover:bg-[linear-gradient(180deg,rgb(245_165_36/0.08),rgb(43_217_197/0.03))] max-md:border-b md:border-r md:last:border-r-0">
      <span className="text-[13px] text-white/60">{label}</span>
      <span className="text-2xl font-light">{value}</span>
      <span className="font-mono text-[11px] text-white/45">{tech}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-normal">{children}</h2>;
}

function CarBars({ findings }: { findings: StockFinding[] }) {
  const rows = findings.filter((f) => f.reaction);
  const max = Math.max(...rows.map((f) => Math.abs(f.reaction!.car)), 0.001);
  return (
    <figure className="flex flex-col gap-3.5 border border-line bg-white/[0.02] p-5 sm:p-6">
      {rows.map((f) => {
        const r = f.reaction!;
        const width = `${(Math.abs(r.car) / max) * 90}%`;
        const color = r.car < 0 ? (r.significant ? 'bg-down' : 'bg-down/40') : r.significant ? 'bg-up' : 'bg-up/40';
        return (
          <div key={f.candidate.symbol} className="grid grid-cols-[52px_minmax(0,1fr)_minmax(0,150px)] items-center gap-3 text-sm">
            <span className="font-mono">{f.candidate.symbol}</span>
            <div className="relative ml-[50%] h-[18px] border-l border-white/30" aria-hidden="true">
              <div className={`absolute top-0.5 h-3.5 ${color} ${r.car < 0 ? 'right-full' : 'left-0'}`} style={{ width }} />
            </div>
            <span className={`text-right ${r.significant ? tone(r.car) : 'text-white/75'}`}>{describeVsMarket(r.car).replace(/^(Turun|Naik) /, '')}</span>
          </div>
        );
      })}
      <figcaption className="flex flex-wrap justify-between gap-2 border-t border-dashed border-white/15 pt-2.5 text-xs text-white/50">
        <span>← turun lebih dalam dari pasar</span>
        <span>Warna penuh = gerak tidak biasa</span>
        <span>naik lebih tinggi dari pasar →</span>
      </figcaption>
    </figure>
  );
}

function FindingRow({ f, open }: { f: StockFinding; open: boolean }) {
  const r = f.reaction;
  const flow = foreignFlowText(f.netForeignInflow);
  return (
    <details open={open} className="group border-b border-line last:border-b-0 open:bg-white/[0.03]">
      <summary className="grid cursor-pointer list-none grid-cols-2 gap-x-3 gap-y-1.5 px-4 py-4 text-sm hover:bg-white/[0.045] md:grid-cols-[150px_minmax(0,1fr)_160px_100px_100px] md:items-center md:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col">
          <span className="font-mono">{f.candidate.symbol}</span>
          <span className="text-xs text-white/50">{f.candidate.name}</span>
        </span>
        <span className="text-white/80 max-md:text-right">{LINK_TYPE_LABEL[f.candidate.linkType]}</span>
        <span className={r ? (r.significant ? tone(r.car) : 'text-white/80') : 'text-white/50'}>
          {r ? describeVsMarket(r.car) : 'Belum ada data harga'}
        </span>
        <span className={`max-md:text-right ${r?.significant ? 'text-amber' : 'text-white/60'}`}>{r ? unusualLabel(r.significant) : '—'}</span>
        <span className="max-md:col-span-2">
          <span className={`inline-block border px-2 py-0.5 font-mono text-[11px] ${EVIDENCE_TAG[f.confidence]}`}>
            {CONFIDENCE_LABEL[f.confidence].replace('Bukti ', '').toUpperCase()}
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-4 md:px-5">
        <p className="border-l border-white/20 pl-3 text-sm leading-relaxed text-white/75">{f.explanation}</p>
        {flow && <p className="pl-3 text-sm text-white/70">{flow} selama periode yang sama.</p>}
        {f.dataNote && <p className="pl-3 text-xs text-white/50">{f.dataNote}</p>}
        <p className="pl-3 font-mono text-[11px] text-white/45">
          Detail teknis: {f.candidate.reason}
          {r && ` · CAR ${formatPct(r.car)} · z ${r.zScore.toFixed(1).replace('.', ',')} · ${formatDateId(r.t0)} s/d ${formatDateId(r.tEnd)} (${r.days} hari bursa)`}
        </p>
      </div>
    </details>
  );
}

export function ReportView({ event, report }: { event: StoredEvent; report: Report }) {
  const retro = report.mode === 'retrospective';
  const withPrice = report.findings.filter((f) => f.reaction);
  const unusual = withPrice.filter((f) => f.reaction!.significant).length;
  const span = withPrice[0]?.reaction;

  return (
    <article className="flex flex-col">
      <header className="flex flex-col gap-4pt-12 pb-8">
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] tracking-wider">
          <span className={retro ? 'border border-[#58a6ff]/45 px-2.5 py-1 text-[#58a6ff]' : 'border border-dashed border-hypo/70 px-2.5 py-1 text-hypo'}>
            {modeLabel(report.mode).toUpperCase()}
          </span>
        </div>
        <h1 className="max-w-[940px] text-3xl leading-tight font-light tracking-tight sm:text-[42px]">{report.headline}</h1>
        <p className="text-sm text-white/60">
          Berita:{' '}
          {event.url ? (
            <a href={event.url} target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-4 hover:text-teal">
              {event.title}
            </a>
          ) : (
            event.title
          )}{' '}
          · terbit {formatDateId(event.publishedAt)} · data harga dari Sectors
        </p>
        {!retro && (
          <p className="max-w-[760px] border border-hypo/30 bg-hypo/10 px-4 py-3 text-sm leading-relaxed text-white/80">
            Belum ada hari bursa setelah berita ini, jadi belum ada angka reaksi. Yang ditampilkan adalah saham yang terkait dan pola dari berita
            serupa sebelumnya. Ini bukan perkiraan harga.
          </p>
        )}
        <p role="note" className="border border-amber/35 bg-amber/5 px-4 py-3 text-sm text-white/80">
          {SHORT_DISCLAIMER} Saham yang terkait belum tentu dipengaruhi berita ini.
        </p>
      </header>

      <div className="spectral-line" />
      <section aria-label="Ringkasan" className={`grid border-b border-line ${withPrice.length > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        {report.market ? (
          <>
            <Kpi label="Hari berita" value={formatDateId(report.market.t0)} tech="hari bursa pertama · T0" />
            <Kpi
              label="Pasar secara umum hari itu"
              value={<span className={tone(report.market.ihsgReturn)}>{marketText(report.market.ihsgReturn)}</span>}
              tech={`IHSG ${formatPct(report.market.ihsgReturn)}`}
            />
          </>
        ) : (
          <>
            <Kpi label="Saham yang terkait" value={report.findings.length} tech="dari isi berita" />
            <Kpi label="Berita serupa sebelumnya" value={report.analogs.reduce((s, a) => s + a.eventCount, 0)} tech="pustaka pola historis" />
          </>
        )}
        {withPrice.length > 0 && (
        <Kpi
          label="Gerak tidak biasa"
          value={
            <>
              {unusual} <span className="text-white/50">dari {withPrice.length} saham</span>
            </>
          }
          tech="|z| ≥ 2"
        />
        )}
        <Kpi label="Kuota data terpakai" value={report.creditsUsed} tech="kredit API Sectors" />
      </section>

      <section className="grid border-b border-line lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6 border-line py-10 lg:border-r lg:pr-10">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-light tracking-tight">
              {withPrice.length > 0 ? 'Seberapa jauh tiap saham bergerak dibanding pasar' : 'Saham yang terkait dengan berita ini'}
            </h2>
            {span && (
              <p className="text-sm leading-relaxed text-white/60">
                Gerak harga saham dikurangi gerak IHSG, dijumlah selama {span.days} hari bursa ({formatDateId(span.t0)} s/d{' '}
                {formatDateId(span.tEnd)}).
              </p>
            )}
          </div>
          {withPrice.length > 0 && <CarBars findings={report.findings} />}
          {report.findings.length > 0 ? (
            <div className="border border-line">
              <div className="hidden grid-cols-[150px_minmax(0,1fr)_160px_100px_100px] gap-3 border-b border-line px-5 py-3 text-xs text-white/55 md:grid" aria-hidden="true">
                <span>Saham</span>
                <span>Kenapa terkait</span>
                <span>Dibanding pasar</span>
                <span>Gerak</span>
                <span>Bukti</span>
              </div>
              {report.findings.map((f, i) => (
                <FindingRow key={f.candidate.symbol} f={f} open={i === 0} />
              ))}
            </div>
          ) : (
            <p className="border border-dashed border-white/20 p-6 text-sm text-white/65">Tidak ada saham yang cukup jelas terkait dengan berita ini.</p>
          )}
          <p className="text-[13px] leading-relaxed text-white/55">
            <b className="font-medium text-white/80">Tidak biasa</b> artinya geraknya jauh di luar naik-turun normal saham itu sebelum berita.{' '}
            <b className="font-medium text-white/80">Bukti kuat</b> artinya geraknya tidak biasa dan sahamnya terkait langsung dengan berita. Klik
            baris saham untuk melihat penjelasannya.
          </p>
        </div>

        <aside className="flex flex-col gap-6 py-10 lg:pl-8">
          <div className="flex flex-col gap-3">
            <SectionTitle>Kenapa saham-saham ini terkait</SectionTitle>
            <ol className="flex flex-col">
              {report.chain.map((step, i) => (
                <li key={i} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2.5 border-t border-line py-3.5 text-sm leading-relaxed">
                  <span className="font-mono text-white/50">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <span className="text-xs text-white/45">Disusun AI dari isi berita. Bisa keliru, cek berita aslinya.</span>
          </div>
          {report.market && (
            <div className="flex flex-col gap-2.5 border border-dashed border-white/20 p-4">
              <span className="text-sm font-medium">Perlu diingat</span>
              <p className="text-sm leading-relaxed text-white/70">
                Pasar secara umum {marketText(report.market.ihsgReturn).toLowerCase()} di hari berita.{' '}
                {report.market.marketWide
                  ? 'Hampir semua saham ikut bergerak besar, jadi kaitan per saham lebih lemah dari biasanya.'
                  : 'Sebagian gerak saham bisa terjadi karena hal lain, bukan hanya berita ini.'}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2.5 border border-warn/35 bg-surface p-4">
            <span className="font-mono text-[11px] tracking-widest text-warn">BUKAN SARAN INVESTASI</span>
            <p className="text-[13px] leading-relaxed text-white/75">{report.disclaimer}</p>
          </div>
        </aside>
      </section>

      <section className="grid border-b border-line md:grid-cols-3">
        <div className="flex flex-col gap-3 border-line py-8 max-md:border-b md:border-r md:pr-8">
          <h3 className="text-[17px]">Per bidang usaha</h3>
          {report.subSectorSummary.length > 0 ? (
            report.subSectorSummary.map((s) => (
              <p key={s.subSector} className="text-sm leading-relaxed text-white/75">
                {s.subSector} ({s.count} saham): rata-rata{' '}
                <span className={tone(s.avgCar)}>{describeVsMarket(s.avgCar).toLowerCase()}</span> dari pasar.
              </p>
            ))
          ) : (
            <p className="text-sm text-white/50">Belum ada data harga per bidang usaha.</p>
          )}
        </div>
        <div className="flex flex-col gap-3 border-line py-8 max-md:border-b md:border-r md:px-8">
          <h3 className="text-[17px]">Berita serupa sebelumnya</h3>
          {report.analogs.length > 0 ? (
            report.analogs.map((a) => (
              <p key={a.subSector} className="text-sm leading-relaxed text-white/75">
                {a.subSector}: dari {a.eventCount} berita serupa, rata-rata{' '}
                <span className={tone(a.avgCar)}>{describeVsMarket(a.avgCar).toLowerCase()}</span> dari pasar.
              </p>
            ))
          ) : (
            <p className="text-sm text-white/50">Belum ada berita serupa di pustaka kami.</p>
          )}
          <span className="text-xs text-white/45">Masa lalu tidak menjamin gerak berikutnya.</span>
        </div>
        <div className="flex flex-col gap-3 py-8 md:pl-8">
          <h3 className="text-[17px]">Turun tajam, belum ada penjelasan</h3>
          {report.unexplainedMovers.length > 0 ? (
            <>
              <p className="text-sm leading-relaxed text-white/75">Saham ini turun tajam di hari yang sama, tapi tidak terkait berita ini.</p>
              {report.unexplainedMovers.map((m) => (
                <div key={m.symbol} className="flex justify-between gap-3 text-sm">
                  <span>
                    <span className="font-mono">{m.symbol}</span> <span className="text-white/50">{m.name}</span>
                  </span>
                  <span className={tone(m.priceChange)}>{formatPct(m.priceChange)}</span>
                </div>
              ))}
            </>
          ) : (
            <p className="text-sm text-white/50">Tidak ada.</p>
          )}
        </div>
      </section>

      {report.otherLinks.length > 0 && (
        <section className="flex flex-col gap-3 border-b border-line py-8">
          <h3 className="text-[17px]">Juga terkait, tapi tanpa data harga</h3>
          <ul className="flex flex-col gap-1.5 text-sm text-white/75">
            {report.otherLinks.map((c) => (
              <li key={c.symbol}>
                <span className="font-mono">{c.symbol}</span> {c.name} · {c.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-col gap-1 py-7 text-[13px] text-white/55 sm:flex-row sm:justify-between">
        <span>
          Kuota data Sectors terpakai: {report.creditsUsed} · Dibuat {CREATED_AT.format(new Date(report.createdAt))} WIB
        </span>
        <span>Membuka laporan ini lagi tidak memakai kuota.</span>
      </footer>
    </article>
  );
}
