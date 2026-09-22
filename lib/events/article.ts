import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isNonPublicAddress } from './ip';

export const MIN_TEXT_LENGTH = 300;
export const FETCH_TIMEOUT_MS = 10_000;

export class ArticleFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArticleFetchError';
  }
}

export interface Article {
  title: string;
  text: string;
  publishedAt: string | null;
}

const PASTE_HINT = 'Silakan tempel teks beritanya.';

export function extractArticle(html: string): Article {
  const { document } = parseHTML(html);
  const publishedAt =
    document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ??
    document.querySelector('meta[name="pubdate"]')?.getAttribute('content') ??
    null;
  const pageTitle = document.querySelector('title')?.textContent?.trim() ?? '';
  const bodyText = document.body?.textContent ?? '';
  const parsed = new Readability(document as unknown as Document).parse();
  const text = (parsed?.textContent || bodyText).replace(/\s+/g, ' ').trim();
  if (text.length < MIN_TEXT_LENGTH) {
    throw new ArticleFetchError(`Teks artikel terlalu pendek atau tidak terbaca (mungkin paywall). ${PASTE_HINT}`);
  }
  return { title: parsed?.title?.trim() || pageTitle || 'Tanpa judul', text, publishedAt };
}

export const MAX_ARTICLE_BYTES = 2_000_000;
export const MAX_REDIRECTS = 3;
const UNREADABLE = `Link tidak bisa dibaca. ${PASTE_HINT}`;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface ResolvedAddress {
  address: string;
  family: number;
}

export interface FetchArticleOptions {
  /** Resolves a hostname to all of its addresses. Defaults to `dns.promises.lookup(host, { all: true })`. */
  lookup?: (host: string) => Promise<ResolvedAddress[]>;
}

const defaultLookup = (host: string): Promise<ResolvedAddress[]> => dnsLookup(host, { all: true });

/** Throws the generic error when a URL is not a public http(s) destination. */
async function assertPublicUrl(url: URL, lookup: (host: string) => Promise<ResolvedAddress[]>): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ArticleFetchError(UNREADABLE);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host)).map((a) => a.address);
    } catch {
      throw new ArticleFetchError(UNREADABLE);
    }
  }
  if (addresses.length === 0 || addresses.some(isNonPublicAddress)) throw new ArticleFetchError(UNREADABLE);
}

async function readLimited(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ARTICLE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new ArticleFetchError(UNREADABLE);
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/**
 * Fetches a user-supplied article URL safely: http(s) only, public addresses only
 * (re-checked on every redirect, at most MAX_REDIRECTS), body capped at MAX_ARTICLE_BYTES.
 * Every failure is a generic ArticleFetchError that leaks no upstream details.
 */
export async function fetchArticle(url: string, fetchImpl: typeof fetch = fetch, options: FetchArticleOptions = {}): Promise<Article> {
  const lookup = options.lookup ?? defaultLookup;
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    throw new ArticleFetchError(UNREADABLE);
  }
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let html: string | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS && html === null; hop++) {
    await assertPublicUrl(current, lookup);
    let res: Response;
    try {
      res = await fetchImpl(current.toString(), {
        signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CorrelationExplainer/1.0)' },
      });
    } catch {
      throw new ArticleFetchError(UNREADABLE);
    }
    if (REDIRECT_STATUSES.has(res.status)) {
      const location = res.headers.get('location');
      await res.body?.cancel().catch(() => undefined);
      if (!location) throw new ArticleFetchError(UNREADABLE);
      try {
        current = new URL(location, current);
      } catch {
        throw new ArticleFetchError(UNREADABLE);
      }
      continue;
    }
    if (!res.ok) throw new ArticleFetchError(UNREADABLE);
    try {
      html = await readLimited(res);
    } catch {
      throw new ArticleFetchError(UNREADABLE);
    }
  }
  if (html === null) throw new ArticleFetchError(UNREADABLE);
  return extractArticle(html);
}
