'use client';

import Link from 'next/link';
import { use, useEffect, useState, type ReactNode } from 'react';
import { ReportView } from '@/components/ReportView';
import { Frame, SiteFooter, SiteNav } from '@/components/SiteNav';
import type { Report, StoredEvent } from '@/lib/domain';
import { POLL_TIMEOUT_MS, shouldKeepPolling } from '@/lib/ui/analysis-status';

interface EventResponse {
  event: StoredEvent;
  report: Report | null;
}

const POLL_MS = 2000;

function Notice({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div role="alert" className="flex max-w-[640px] flex-col gap-3.5 border border-line bg-[#13151a] p-6">
      <h1 className="text-2xl font-light">{title}</h1>
      <p className="text-sm leading-relaxed text-white/70">{children}</p>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

const primaryBtn = 'bg-fg px-4 py-2.5 text-sm text-ink hover:opacity-90';
const ghostBtn = 'border border-line-strong px-4 py-2.5 text-sm hover:border-fg hover:bg-fg hover:text-ink';

function Progress({ event }: { event: StoredEvent | null }) {
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <span className="animate-pulse font-mono text-[11px] tracking-widest text-amber">● SEDANG DIANALISIS</span>
        <h1 className="text-3xl leading-tight font-light tracking-tight">{event?.title ?? 'Memuat berita…'}</h1>
        <p className="text-[15px] text-white/60">Biasanya selesai dalam 1 menit. Halaman ini diperbarui sendiri, tidak perlu dimuat ulang.</p>
        <p aria-live="polite" className="flex items-center gap-3 border-y border-line py-4 text-base">
          <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-amber/30 border-t-amber" aria-hidden="true" />
          {event?.statusMessage ?? 'Menunggu analisis dimulai…'}
        </p>
        <p className="text-[13px] text-white/50">
          Laporan ini memakai paling banyak sekitar 19 kuota data. Setelah jadi, siapa pun bisa membukanya tanpa memakai kuota lagi.
        </p>
      </div>
      <div className="grid-paper grid grid-cols-2 content-start gap-4 p-6" aria-hidden="true">
        {(event?.symbols.length ? event.symbols : ['', '', '', '']).slice(0, 4).map((s, i) => (
          <div key={i} className={`flex flex-col gap-2 border border-white/15 bg-card p-4 ${i % 2 ? 'rotate-2' : '-rotate-2'}`}>
            {s ? <span className="font-mono text-lg">{s}</span> : <div className="skeleton h-5 w-16" />}
            <div className="skeleton h-8 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<EventResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
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
          setNotFound(true);
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
  const minutes = Math.round(POLL_TIMEOUT_MS / 60_000);

  let body: ReactNode;
  if (data?.report) body = <ReportView event={data.event} report={data.report} />;
  else if (notFound)
    body = (
      <Notice title="Laporan tidak ditemukan" actions={<Link href="/" className={ghostBtn}>Kembali ke beranda</Link>}>
        Tautannya mungkin salah atau laporannya sudah dihapus.
      </Notice>
    );
  else if (failed)
    body = (
      <Notice title="Analisis berita ini gagal" actions={<Link href="/" className={primaryBtn}>Coba lagi dari beranda</Link>}>
        {data?.event.statusMessage ?? 'Data yang dibutuhkan tidak bisa diambil saat ini.'} Coba lagi dalam beberapa menit.
      </Notice>
    );
  else if (timedOut)
    body = (
      <Notice
        title="Analisis belum selesai"
        actions={
          <>
            <button type="button" onClick={() => location.reload()} className={primaryBtn}>
              Muat ulang
            </button>
            <Link href="/" className={ghostBtn}>
              Ke beranda
            </Link>
          </>
        }
      >
        Sudah {minutes} menit dan laporannya belum jadi. Muat ulang halaman ini, atau jalankan lagi dari beranda.
      </Notice>
    );
  else body = <Progress event={data?.event ?? null} />;

  return (
    <Frame>
      <SiteNav>
        <Link href="/" className="text-sm text-white/70 hover:text-fg">
          ← Kembali ke beranda
        </Link>
      </SiteNav>
      <main>{data?.report ? body : <div className="px-4 py-12 sm:px-10">{body}</div>}</main>
      <SiteFooter />
    </Frame>
  );
}
