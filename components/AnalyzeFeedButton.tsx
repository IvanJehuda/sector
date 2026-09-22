'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AnalyzeFeedButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    });
    setBusy(false);
    if (res.status === 202) router.push(`/events/${eventId}`);
  }

  return (
    <button type="button" onClick={run} disabled={busy} className="shrink-0 rounded border px-3 py-1 text-sm disabled:opacity-50">
      {busy ? 'Memproses…' : 'Analisis'}
    </button>
  );
}
