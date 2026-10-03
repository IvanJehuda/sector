'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { requestAnalysis } from '@/lib/ui/request-analysis';
import { SHORT_DISCLAIMER, splitNewsInput } from '@/lib/ui/present';

export function AnalyzeForm() {
  const router = useRouter();
  const [news, setNews] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input = splitNewsInput(news);
    if (!input.url && !input.text) {
      setError('Tempel tautan atau isi berita dulu.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await requestAnalysis({ ...input, date: date || undefined });
      if (result.ok) {
        router.push(`/events/${result.eventId}`);
        return;
      }
      setError(result.error);
    } catch {
      setError('Terjadi kesalahan pada server. Coba lagi sebentar lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="relative flex flex-col gap-3">
      <div className="border border-line-strong bg-surface">
        <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5 font-mono text-[11px] tracking-wide text-white/55">
          <label htmlFor="news-input">TAUTAN ATAU ISI BERITA</label>
          <span id="news-hint" className="text-[10px] sm:text-[11px]">ISI BERITA MINIMAL 80 HURUF</span>
        </div>
        <textarea
          id="news-input"
          value={news}
          onChange={(e) => setNews(e.target.value)}
          rows={3}
          placeholder="Tempel tautan berita (https://…) atau isi beritanya di sini"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'news-error news-hint' : 'news-hint'}
          className="block w-full resize-y bg-transparent px-5 py-4 font-mono text-sm leading-relaxed text-fg outline-none placeholder:text-white/40"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <div className="flex items-center gap-3">
            <label htmlFor="news-date" className="font-mono text-[11px] tracking-wide whitespace-nowrap text-white/55">
              Tanggal berita (opsional)
            </label>
            <input
              id="news-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 border border-line-strong bg-ink px-2.5 font-mono text-[13px] text-fg [color-scheme:dark]"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="h-11 bg-fg px-6 text-sm font-medium whitespace-nowrap text-ink transition hover:-translate-y-px hover:shadow-[0_0_0_1px_#fff,0_8px_40px_rgb(245_165_36/0.45),0_0_60px_rgb(43_217_197/0.25)] disabled:opacity-50"
          >
            {busy ? 'Memproses…' : 'Cek dampak berita →'}
          </button>
        </div>
      </div>
      {error && (
        <p id="news-error" role="alert" className="text-sm leading-relaxed text-[#ff8a80]">
          {error}
        </p>
      )}
      <p className="text-xs text-white/60">{SHORT_DISCLAIMER}</p>
    </form>
  );
}
