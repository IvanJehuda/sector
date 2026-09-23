'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { requestAnalysis } from '@/lib/ui/request-analysis';

export function AnalyzeFeedButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await requestAnalysis({ eventId });
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
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="h-9 border border-line-strong px-3.5 text-[13px] transition hover:border-teal hover:text-teal disabled:opacity-50"
      >
        {busy ? 'Memproses…' : 'Analisis'}
      </button>
      {error && (
        <p role="alert" className="max-w-xs text-right text-xs text-[#ff8a80]">
          {error}
        </p>
      )}
    </div>
  );
}
