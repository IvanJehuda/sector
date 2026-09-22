import type { EventInput } from '@/lib/domain';
import { eventCalendarDate } from '@/lib/market/dates';
import { fetchArticle, type FetchArticleOptions } from './article';

export const MIN_MANUAL_TEXT = 80;
const MAX_TITLE = 120;

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

export interface ManualRequest {
  url?: string;
  text?: string;
  title?: string;
  date?: string;
}

export function manualEvent(p: { url: string | null; title: string; text: string; publishedAt: string }): EventInput {
  return { source: 'manual', url: p.url, title: p.title, body: p.text, publishedAt: p.publishedAt, symbols: [], tags: [], subSectors: [] };
}

function firstSentence(text: string): string {
  const sentence = text.split(/(?<=[.!?])\s/)[0].trim();
  return sentence.length > MAX_TITLE ? `${sentence.slice(0, MAX_TITLE - 3)}...` : sentence;
}

/** True when an article's published time can be used as the event time. */
function usablePublishedAt(value: string | null): value is string {
  if (!value || Number.isNaN(Date.parse(value))) return false;
  try {
    eventCalendarDate(value);
    return true;
  } catch {
    return false;
  }
}

export async function buildManualEvent(
  req: ManualRequest,
  today: string,
  fetchImpl: typeof fetch = fetch,
  articleOptions: FetchArticleOptions = {},
): Promise<EventInput> {
  const text = req.text?.trim();
  if (text) {
    if (text.length < MIN_MANUAL_TEXT) throw new InputError(`Teks berita terlalu pendek (minimal ${MIN_MANUAL_TEXT} karakter).`);
    return manualEvent({
      url: req.url ?? null,
      title: req.title?.trim() || firstSentence(text),
      text,
      publishedAt: req.date ?? today,
    });
  }
  if (req.url) {
    const article = await fetchArticle(req.url, fetchImpl, articleOptions);
    return manualEvent({
      url: req.url,
      title: req.title?.trim() || article.title,
      text: article.text,
      publishedAt: req.date ?? (usablePublishedAt(article.publishedAt) ? article.publishedAt : today),
    });
  }
  throw new InputError('Isi link berita atau tempel teks beritanya.');
}
