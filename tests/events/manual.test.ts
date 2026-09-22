import { describe, expect, it, vi } from 'vitest';
import { buildManualEvent, InputError } from '@/lib/events/manual';

const TODAY = '2026-09-22';
const para = 'Pemerintah mengumumkan kebijakan baru untuk sektor perbankan nasional pada pekan ini. '.repeat(6);
const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const longText = 'Presiden menyampaikan pidato tentang rencana pengelolaan BUMN melalui badan investasi baru. '.repeat(3);

describe('buildManualEvent', () => {
  it('prefers pasted text and derives a title from the first sentence', async () => {
    const e = await buildManualEvent({ text: longText, date: '2026-03-07' }, TODAY);
    expect(e).toMatchObject({ source: 'manual', url: null, publishedAt: '2026-03-07', symbols: [] });
    expect(e.title).toBe('Presiden menyampaikan pidato tentang rencana pengelolaan BUMN melalui badan investasi baru.');
  });

  it('defaults the date to today', async () => {
    expect((await buildManualEvent({ text: longText }, TODAY)).publishedAt).toBe(TODAY);
  });

  it('rejects text that is too short and empty requests', async () => {
    await expect(buildManualEvent({ text: 'pendek' }, TODAY)).rejects.toBeInstanceOf(InputError);
    await expect(buildManualEvent({}, TODAY)).rejects.toBeInstanceOf(InputError);
  });

  it('fetches the URL when no text is given and uses the article date', async () => {
    const html = `<html><head><title>Kebijakan</title><meta property="article:published_time" content="2026-03-06T20:00:00+07:00"></head><body><article><p>${para}</p></article></body></html>`;
    const fetchImpl = vi.fn(async () => new Response(html, { status: 200 }));
    const e = await buildManualEvent({ url: 'https://example.com/b' }, TODAY, fetchImpl as unknown as typeof fetch, { lookup: publicLookup });
    expect(e.url).toBe('https://example.com/b');
    expect(e.publishedAt).toBe('2026-03-06T20:00:00+07:00');
  });

  it.each(['kemarin sore', '2026-13-45T10:00:00', ''])('falls back to today when the article date %j does not parse', async (meta) => {
    const html = `<html><head><title>Kebijakan</title><meta property="article:published_time" content="${meta}"></head><body><article><p>${para}</p></article></body></html>`;
    const fetchImpl = vi.fn(async () => new Response(html, { status: 200 }));
    const e = await buildManualEvent({ url: 'https://example.com/c' }, TODAY, fetchImpl as unknown as typeof fetch, { lookup: publicLookup });
    expect(e.publishedAt).toBe(TODAY);
  });

  it('prefers the user date over the article date', async () => {
    const html = `<html><head><title>Kebijakan</title><meta property="article:published_time" content="2026-03-06T20:00:00+07:00"></head><body><article><p>${para}</p></article></body></html>`;
    const fetchImpl = vi.fn(async () => new Response(html, { status: 200 }));
    const e = await buildManualEvent({ url: 'https://example.com/d', date: '2026-03-01' }, TODAY, fetchImpl as unknown as typeof fetch, {
      lookup: publicLookup,
    });
    expect(e.publishedAt).toBe('2026-03-01');
  });
});
