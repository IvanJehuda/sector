'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const MAX_CREDITS_PER_ANALYSIS = 19;

export function AnalyzeForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url || undefined, text: text || undefined, date: date || undefined }),
    });
    const body = (await res.json()) as { eventId?: string; error?: string };
    setBusy(false);
    if (res.status === 202 && body.eventId) {
      router.push(`/events/${body.eventId}`);
      return;
    }
    setError(body.error ?? 'Terjadi kesalahan.');
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">Cek berita atau event</h2>
      <label className="block text-sm font-medium">
        Link berita
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Atau tempel teks berita
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Tanggal event (opsional)
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 rounded border px-3 py-2" />
      </label>
      <p className="text-xs text-gray-500">
        Analisis memakai maksimal ~{MAX_CREDITS_PER_ANALYSIS} kredit Sectors (lebih sedikit jika data sudah di-cache).
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        {busy ? 'Memproses…' : 'Analisis berita'}
      </button>
    </form>
  );
}
