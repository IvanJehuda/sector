import Link from 'next/link';
import type { StoredEvent } from '@/lib/domain';
import { isAnalysisInFlight } from '@/lib/ui/analysis-status';
import { formatDateId } from '@/lib/ui/present';
import { AnalyzeFeedButton } from './AnalyzeFeedButton';
import { Container } from './SiteNav';

type Status = 'done' | 'running' | 'failed' | 'new';

const TAG: Record<Status, { text: string; className: string }> = {
  done: { text: 'SELESAI', className: 'border-up/40 text-up' },
  running: { text: 'SEDANG DIANALISIS', className: 'border-warn/40 text-warn' },
  failed: { text: 'GAGAL', className: 'border-down/40 text-down' },
  new: { text: 'BELUM DIANALISIS', className: 'border-line-strong text-white/70' },
};

function statusOf(e: StoredEvent, now: Date): Status {
  if (e.status === 'done') return 'done';
  if (isAnalysisInFlight(e, now)) return 'running';
  return e.status === 'failed' ? 'failed' : 'new';
}

export function Feed({ events }: { events: StoredEvent[] }) {
  const now = new Date();
  return (
    <section id="berita" aria-labelledby="berita-judul" className="scroll-mt-20 pt-16 pb-14">
      <Container className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <span className="font-mono text-xs tracking-widest text-white/80">{'// BERITA TERBARU //'}</span>
          <h2 id="berita-judul" className="text-3xl font-light tracking-tight sm:text-4xl">
            Berita dari Sectors, diperbarui 3 kali sehari
          </h2>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-start gap-2.5 border border-dashed border-white/20 p-6">
            <p className="text-base">Belum ada berita hari ini</p>
            <p className="text-sm leading-relaxed text-white/65">
              Berita dari Sectors masuk otomatis setiap hari bursa. Sambil menunggu, tempel berita apa saja di kotak di atas.
            </p>
          </div>
        ) : (
          <ul className="border border-line">
            <li className="hidden grid-cols-[120px_minmax(0,1fr)_170px_170px_110px] gap-4 border-b border-line px-5 py-3 font-mono text-[11px] tracking-wide text-white/50 md:grid" aria-hidden="true">
              <span>TANGGAL</span>
              <span>BERITA</span>
              <span>STATUS</span>
              <span>SAHAM TERKAIT</span>
              <span />
            </li>
            {events.map((e) => {
              const status = statusOf(e, now);
              const tag = TAG[status];
              return (
                <li
                  key={e.id}
                  className="grid gap-2 border-b border-line px-5 py-4 transition-colors last:border-b-0 hover:bg-white/[0.045] md:grid-cols-[120px_minmax(0,1fr)_170px_170px_110px] md:items-center md:gap-4"
                >
                  <span className="font-mono text-[13px] text-white/60">
                    {formatDateId(e.publishedAt)}
                    <span className="ml-2 text-white/40 md:hidden">· {e.source === 'feed' ? 'Sectors' : 'Manual'}</span>
                  </span>
                  <span className="text-[15px] leading-snug">{e.title}</span>
                  <span>
                    <span className={`inline-block border px-2 py-1 font-mono text-[11px] tracking-wide ${tag.className}`}>{tag.text}</span>
                  </span>
                  <span className="font-mono text-[13px] text-white/80">{e.symbols.length > 0 ? e.symbols.join(' · ') : '—'}</span>
                  <span className="md:justify-self-end">
                    {status === 'done' || status === 'running' ? (
                      <Link href={`/events/${e.id}`} className="group text-sm text-white/80 hover:text-amber">
                        {status === 'done' ? 'Lihat laporan' : 'Lihat status'}{' '}
                        <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                      </Link>
                    ) : (
                      <AnalyzeFeedButton eventId={e.id} />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </section>
  );
}
