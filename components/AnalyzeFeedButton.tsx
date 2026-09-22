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
      setError('Terjadi kesalahan pada server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button type="button" onClick={run} disabled={busy} className="rounded border px-3 py-1 text-sm disabled:opacity-50">
        {busy ? 'Memproses…' : 'Analisis'}
      </button>
      {error && (
        <p role="alert" className="max-w-xs text-right text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
