import { describe, expect, it, vi } from 'vitest';
import { ArticleFetchError, extractArticle, fetchArticle, MAX_ARTICLE_BYTES, type FetchArticleOptions } from '@/lib/events/article';

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

type Lookup = NonNullable<FetchArticleOptions['lookup']>;
const publicLookup: Lookup = async () => [{ address: '93.184.216.34', family: 4 }];
const lookupTo = (address: string, family = address.includes(':') ? 6 : 4): Lookup => async () => [{ address, family }];
const GENERIC = 'Link tidak bisa dibaca. Silakan tempel teks beritanya.';

function fetchOk(body: string = html) {
  return vi.fn(async () => new Response(body, { status: 200 }));
}

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

describe('fetchArticle', () => {
  it('fetches and extracts', async () => {
    const fetchImpl = fetchOk();
    const a = await fetchArticle('https://example.com/a', fetchImpl as unknown as typeof fetch, { lookup: publicLookup });
    expect(a.text).toContain('sektor perbankan');
    expect(fetchImpl).toHaveBeenCalledWith('https://example.com/a', expect.objectContaining({ redirect: 'manual' }));
  });

  it('turns HTTP errors and network failures into a generic ArticleFetchError', async () => {
    const forbidden = vi.fn(async () => new Response('no', { status: 403 }));
    const err = await fetchArticle('https://example.com/a', forbidden as unknown as typeof fetch, { lookup: publicLookup }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ArticleFetchError);
    expect((err as Error).message).toBe(GENERIC);
    expect((err as Error).message).not.toContain('403');
    const down = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(fetchArticle('https://example.com/a', down as unknown as typeof fetch, { lookup: publicLookup })).rejects.toThrow(GENERIC);
  });

  it.each(['ftp://example.com/a', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url'])('rejects non-http(s) URL %s', async (url) => {
    const fetchImpl = fetchOk();
    await expect(fetchArticle(url, fetchImpl as unknown as typeof fetch, { lookup: publicLookup })).rejects.toThrow(GENERIC);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(['127.0.0.1', '10.1.2.3', '169.254.169.254', '172.20.0.5', '192.168.1.1', '100.64.0.1', '0.0.0.0', '::1', '::', '::ffff:10.0.0.1', 'fd00::1', 'fe80::1'])(
    'rejects a hostname resolving to %s',
    async (address) => {
      const fetchImpl = fetchOk();
      const err = await fetchArticle('https://intranet.example/a', fetchImpl as unknown as typeof fetch, { lookup: lookupTo(address) }).catch(
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(ArticleFetchError);
      expect((err as Error).message).toBe(GENERIC);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('rejects when any resolved address is private', async () => {
    const fetchImpl = fetchOk();
    const lookup: Lookup = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ];
    await expect(fetchArticle('https://example.com/a', fetchImpl as unknown as typeof fetch, { lookup })).rejects.toThrow(GENERIC);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(['http://127.0.0.1/a', 'http://[::1]/a', 'http://[::ffff:127.0.0.1]/a', 'http://169.254.169.254/latest/meta-data'])(
    'rejects IP-literal host %s without a DNS lookup',
    async (url) => {
      const fetchImpl = fetchOk();
      const lookup = vi.fn(publicLookup);
      await expect(fetchArticle(url, fetchImpl as unknown as typeof fetch, { lookup })).rejects.toThrow(GENERIC);
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(lookup).not.toHaveBeenCalled();
    },
  );

  it('rejects when DNS resolution fails', async () => {
    const lookup: Lookup = async () => {
      throw new Error('ENOTFOUND');
    };
    await expect(fetchArticle('https://nope.example/a', fetchOk() as unknown as typeof fetch, { lookup })).rejects.toThrow(GENERIC);
  });

  it('follows a valid redirect', async () => {
    const fetchImpl = vi.fn(async (url: string) => (url === 'https://example.com/a' ? redirect('/b') : new Response(html, { status: 200 })));
    const a = await fetchArticle('https://example.com/a', fetchImpl as unknown as typeof fetch, { lookup: publicLookup });
    expect(a.text).toContain('sektor perbankan');
    expect(fetchImpl).toHaveBeenLastCalledWith('https://example.com/b', expect.anything());
  });

  it('rejects a redirect to a private address', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url === 'https://example.com/a' ? redirect('http://internal.example/secret') : new Response(html, { status: 200 }),
    );
    const lookup: Lookup = async (host) => [{ address: host === 'internal.example' ? '192.168.0.10' : '93.184.216.34', family: 4 }];
    await expect(fetchArticle('https://example.com/a', fetchImpl as unknown as typeof fetch, { lookup })).rejects.toThrow(GENERIC);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a redirect to a non-http scheme', async () => {
    const fetchImpl = vi.fn(async () => redirect('file:///etc/passwd'));
    await expect(fetchArticle('https://example.com/a', fetchImpl as unknown as typeof fetch, { lookup: publicLookup })).rejects.toThrow(GENERIC);
  });

  it('follows up to 3 redirects and rejects more', async () => {
    const chain = (hops: number) =>
      vi.fn(async (url: string) => {
        const n = Number(new URL(url).pathname.slice(1));
        return n < hops ? redirect(`/${n + 1}`) : new Response(html, { status: 200 });
      });
    const three = chain(3);
    await expect(fetchArticle('https://example.com/0', three as unknown as typeof fetch, { lookup: publicLookup })).resolves.toMatchObject({
      title: expect.any(String),
    });
    expect(three).toHaveBeenCalledTimes(4);
    const four = chain(4);
    await expect(fetchArticle('https://example.com/0', four as unknown as typeof fetch, { lookup: publicLookup })).rejects.toThrow(GENERIC);
    expect(four).toHaveBeenCalledTimes(4);
  });

  it('rejects an oversized body', async () => {
    const huge = html + ' '.repeat(MAX_ARTICLE_BYTES);
    await expect(fetchArticle('https://example.com/a', fetchOk(huge) as unknown as typeof fetch, { lookup: publicLookup })).rejects.toThrow(GENERIC);
  });
});
