import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

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

export async function fetchArticle(url: string, fetchImpl: typeof fetch = fetch): Promise<Article> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CorrelationExplainer/1.0)' },
    });
  } catch {
    throw new ArticleFetchError(`Link tidak bisa diakses (timeout atau jaringan). ${PASTE_HINT}`);
  }
  if (!res.ok) throw new ArticleFetchError(`Link mengembalikan status ${res.status}. ${PASTE_HINT}`);
  return extractArticle(await res.text());
}
