export type AnalysisRequestResult = { ok: true; eventId: string } | { ok: false; error: string };

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** POSTs to /api/analyze and never throws: every failure becomes an Indonesian error message. */
export async function requestAnalysis(
  body: Record<string, unknown>,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): Promise<AnalysisRequestResult> {
  let res: Response;
  try {
    res = await fetchImpl('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: 'Tidak bisa menghubungi server.' };
  }
  let data: { eventId?: unknown; error?: unknown } = {};
  try {
    const parsed: unknown = await res.json();
    if (parsed && typeof parsed === 'object') data = parsed;
  } catch {
    // non-JSON body (proxy error page, timeout): fall through to the generic message
  }
  if (res.status === 202 && typeof data.eventId === 'string') return { ok: true, eventId: data.eventId };
  if (typeof data.error === 'string' && data.error) return { ok: false, error: data.error };
  return { ok: false, error: 'Terjadi kesalahan pada server.' };
}
