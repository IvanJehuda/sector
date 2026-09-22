import { describe, expect, it, vi } from 'vitest';
import { ArticleFetchError, extractArticle, fetchArticle } from '@/lib/events/article';

const para = 'Pemerintah mengumumkan kebijakan baru untuk sektor perbankan nasional pada pekan ini. '.repeat(6);
const html = `<!doctype html><html><head><title>Kebijakan Bank BUMN</title>
<meta property="article:published_time" content="2026-03-07T09:00:00+07:00"></head>
<body><nav>Menu Beranda Kategori</nav><article><h1>Kebijakan Bank BUMN</h1><p>${para}</p><p>${para}</p></article>
<footer>Hak cipta</footer></body></html>`;

describe('extractArticle', () => {
  it('extracts readable text, a title and the published time', () => {
    const a = extractArticle(html);
    expect(a.title.length).toBeGreaterThan(0);
    expect(a.text).toContain('Pemerintah mengumumkan kebijakan baru');
    expect(a.text.length).toBeGreaterThanOrEqual(300);
    expect(a.publishedAt).toBe('2026-03-07T09:00:00+07:00');
  });

  it('rejects pages without enough text', () => {
    expect(() => extractArticle('<html><body><p>Berlangganan untuk membaca.</p></body></html>')).toThrow(ArticleFetchError);
  });
});

describe('fetchArticle', () => {
  it('fetches and extracts', async () => {
    const fetchImpl = vi.fn(async () => new Response(html, { status: 200 }));
    const a = await fetchArticle('https://example.com/a', fetchImpl as unknown as typeof fetch);
    expect(a.text).toContain('sektor perbankan');
  });

  it('turns HTTP errors and network failures into ArticleFetchError', async () => {
    const forbidden = vi.fn(async () => new Response('no', { status: 403 }));
    await expect(fetchArticle('https://example.com/a', forbidden as unknown as typeof fetch)).rejects.toThrow('403');
    const down = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(fetchArticle('https://example.com/a', down as unknown as typeof fetch)).rejects.toBeInstanceOf(ArticleFetchError);
  });
});
