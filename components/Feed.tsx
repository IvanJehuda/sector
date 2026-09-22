import Link from 'next/link';
import type { StoredEvent } from '@/lib/domain';
import { AnalyzeFeedButton } from './AnalyzeFeedButton';

export function Feed({ events }: { events: StoredEvent[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Berita terbaru</h2>
      {events.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada berita. Penerima otomatis berjalan setiap hari bursa.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {events.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-4 p-3">
              <div className="min-w-0">
                <p className="font-medium">{e.title}</p>
                <p className="text-xs text-gray-500">
                  {e.publishedAt.slice(0, 16).replace('T', ' ')} · {e.source === 'feed' ? 'Sectors' : 'Manual'}
                  {e.symbols.length > 0 ? ` · ${e.symbols.join(', ')}` : ''}
                </p>
                {e.tags.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {e.tags.map((t) => (
                      <span key={t} className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                        {t}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              {e.status === 'done' ? (
                <Link href={`/events/${e.id}`} className="shrink-0 text-sm text-blue-700 underline">
                  Lihat laporan
                </Link>
              ) : (
                <AnalyzeFeedButton eventId={e.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
