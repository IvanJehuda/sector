import Link from 'next/link';
import type { StoredEvent } from '@/lib/domain';

/** Latest feed titles running across the top of the page. Pauses on hover. */
export function NewsTicker({ events }: { events: StoredEvent[] }) {
  const items = events.slice(0, 12);
  if (items.length === 0) return null;
  const row = (hidden: boolean) =>
    items.map((e) => (
      <Link
        key={`${hidden ? 'b' : 'a'}-${e.id}`}
        href={e.status === 'done' ? `/events/${e.id}` : '#berita'}
        tabIndex={hidden ? -1 : undefined}
        className="flex shrink-0 items-center gap-3 px-6 hover:text-amber"
      >
        <span className={e.status === 'done' ? 'text-up' : 'text-amber'} aria-hidden="true">
          {e.status === 'done' ? '●' : '○'}
        </span>
        <span>{e.title}</span>
        {e.symbols.length > 0 && <span className="text-white/45">{e.symbols.slice(0, 3).join(' ')}</span>}
      </Link>
    ));
  return (
    <div className="group relative overflow-hidden border-b border-line bg-black/40 font-mono text-xs">
      <span className="absolute inset-y-0 left-0 z-10 flex items-center bg-amber px-3 font-medium tracking-widest text-ink">BERITA</span>
      <div className="ticker flex h-9 w-max items-center group-hover:[animation-play-state:paused]">
        <div className="flex">{row(false)}</div>
        <div className="flex" aria-hidden="true">
          {row(true)}
        </div>
      </div>
    </div>
  );
}
