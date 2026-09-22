'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ReportView } from '@/components/ReportView';
import type { Report, StoredEvent } from '@/lib/domain';

interface EventResponse {
  event: StoredEvent;
  report: Report | null;
}

const POLL_MS = 2000;

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<EventResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      const res = await fetch(`/api/events/${id}`, { cache: 'no-store' });
      if (!active) return;
      if (!res.ok) {
        setError('Event tidak ditemukan.');
        return;
      }
      const body = (await res.json()) as EventResponse;
      setData(body);
      if (!body.report && body.event.status !== 'failed') timer = setTimeout(tick, POLL_MS);
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
      {!error && !data && <p>Memuat…</p>}
      {data && !data.report && !failed && <p aria-live="polite">{data.event.statusMessage ?? 'Menunggu analisis…'}</p>}
      {failed && (
        <p role="alert" className="text-red-700">
          {data?.event.statusMessage ?? 'Analisis gagal.'}
        </p>
      )}
      {data?.report && <ReportView event={data.event} report={data.report} />}
    </main>
  );
}
