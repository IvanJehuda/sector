'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ReportView } from '@/components/ReportView';
import type { Report, StoredEvent } from '@/lib/domain';
import { POLL_TIMEOUT_MS, shouldKeepPolling } from '@/lib/ui/analysis-status';

interface EventResponse {
  event: StoredEvent;
  report: Report | null;
}

const POLL_MS = 2000;

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<EventResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      let res: Response;
      let body: EventResponse;
      try {
        res = await fetch(`/api/events/${id}`, { cache: 'no-store' });
        if (!active) return;
        if (res.status === 404) {
          setError('Event tidak ditemukan.');
          return;
        }
        if (!res.ok) throw new Error(`status ${res.status}`);
        body = (await res.json()) as EventResponse;
      } catch {
        // transient server/network error: keep polling until the timeout
        if (!active) return;
        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) setTimedOut(true);
        else timer = setTimeout(tick, POLL_MS);
        return;
      }
      if (!active) return;
      setData(body);
      const next = shouldKeepPolling({ hasReport: body.report !== null, status: body.event.status, elapsedMs: Date.now() - startedAt });
      if (next === 'poll') timer = setTimeout(tick, POLL_MS);
      else if (next === 'timeout') setTimedOut(true);
    }
    void tick();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  const failed = data?.event.status === 'failed' && !data.report;
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <Link href="/" className="text-sm underline">
        ← Kembali
      </Link>
      {error && <p role="alert">{error}</p>}
      {!error && !data && !timedOut && <p>Memuat…</p>}
      {data && !data.report && !failed && !timedOut && <p aria-live="polite">{data.event.statusMessage ?? 'Menunggu analisis…'}</p>}
      {timedOut && !data?.report && !failed && (
        <p role="alert" className="text-red-700">
          Analisis belum selesai. Coba muat ulang atau jalankan analisis lagi dari beranda.
        </p>
      )}
      {failed && (
        <p role="alert" className="text-red-700">
          {data?.event.statusMessage ?? 'Analisis gagal.'}
        </p>
      )}
      {data?.report && <ReportView event={data.event} report={data.report} />}
    </main>
  );
}
