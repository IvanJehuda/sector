import { describe, expect, it, vi } from 'vitest';
import { requestAnalysis } from '@/lib/ui/request-analysis';

function fetchReturning(res: Response) {
  return vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => res);
}

describe('requestAnalysis', () => {
  it('posts the body as JSON and returns the event id on 202', async () => {
    const fetchImpl = fetchReturning(Response.json({ eventId: 'e1' }, { status: 202 }));
    expect(await requestAnalysis({ eventId: 'e1' }, fetchImpl)).toEqual({ ok: true, eventId: 'e1' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/analyze');
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"eventId":"e1"}' });
  });

  it('returns the server error message on non-202 responses', async () => {
    const fetchImpl = fetchReturning(Response.json({ error: 'Batas analisis harian sudah tercapai.' }, { status: 429 }));
    expect(await requestAnalysis({ eventId: 'e1' }, fetchImpl)).toEqual({ ok: false, error: 'Batas analisis harian sudah tercapai.' });
  });

  it('returns a generic message for non-JSON responses', async () => {
    const fetchImpl = fetchReturning(new Response('<html>Gateway Timeout</html>', { status: 504 }));
    expect(await requestAnalysis({ text: 'x' }, fetchImpl)).toEqual({ ok: false, error: 'Terjadi kesalahan pada server.' });
  });

  it('returns a generic message for a 202 without an event id', async () => {
    const fetchImpl = fetchReturning(Response.json({}, { status: 202 }));
    expect(await requestAnalysis({ text: 'x' }, fetchImpl)).toEqual({ ok: false, error: 'Terjadi kesalahan pada server.' });
  });

  it('reports network failures', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await requestAnalysis({ text: 'x' }, fetchImpl)).toEqual({ ok: false, error: 'Tidak bisa menghubungi server.' });
  });
});
