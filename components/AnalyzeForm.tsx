'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { requestAnalysis } from '@/lib/ui/request-analysis';

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
    try {
      const result = await requestAnalysis({ url: url || undefined, text: text || undefined, date: date || undefined });
      if (result.ok) {
        router.push(`/events/${result.eventId}`);
        return;
      }
      setError(result.error);
    } catch {
      setError('Terjadi kesalahan pada server.');
    } finally {
      setBusy(false);
    }
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
        Analisis memakai sekitar ≤{MAX_CREDITS_PER_ANALYSIS} kredit Sectors (lebih sedikit jika data sudah di-cache; analisis pertama
        kali bisa sedikit lebih banyak karena daftar emiten diambil sekali).
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
