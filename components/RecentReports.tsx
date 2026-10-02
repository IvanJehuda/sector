import Link from 'next/link';
import type { StoredEvent } from '@/lib/domain';
import { RECENT_REPORTS_LABEL, RECENT_REPORTS_LINK, RECENT_REPORTS_TITLE, symbolsLabel } from '@/lib/ui/home';
import { formatDateId } from '@/lib/ui/present';
import { Container } from './SiteNav';

/** Finished reports, kept on the homepage so newly polled news cannot push them out of sight. */
export function RecentReports({ events }: { events: StoredEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section id="laporan" aria-labelledby="laporan-judul" className="scroll-mt-20 border-b border-line pt-16 pb-14">
      <Container className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <span className="font-mono text-xs tracking-widest text-white/80">{RECENT_REPORTS_LABEL}</span>
          <h2 id="laporan-judul" className="text-3xl font-light sm:text-4xl">
            {RECENT_REPORTS_TITLE}
          </h2>
        </div>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.id}`}
                className="group flex h-full flex-col gap-3 border border-line bg-white/[0.02] p-5 transition-colors hover:border-amber/60 hover:bg-white/[0.045]"
              >
                <span className="font-mono text-[13px] text-white/60">{formatDateId(e.publishedAt)}</span>
                <span className="line-clamp-3 text-[15px] leading-snug">{e.title}</span>
                <span className="mt-auto font-mono text-[13px] text-white/80">{symbolsLabel(e.symbols)}</span>
                <span className="text-sm text-white/80 group-hover:text-amber">
                  {RECENT_REPORTS_LINK} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
