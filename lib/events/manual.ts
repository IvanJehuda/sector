import type { EventInput } from '@/lib/domain';
import { fetchArticle } from './article';

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

export async function buildManualEvent(req: ManualRequest, today: string, fetchImpl: typeof fetch = fetch): Promise<EventInput> {
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
    const article = await fetchArticle(req.url, fetchImpl);
    return manualEvent({
      url: req.url,
      title: req.title?.trim() || article.title,
      text: article.text,
      publishedAt: req.date ?? article.publishedAt ?? today,
    });
  }
  throw new InputError('Isi link berita atau tempel teks beritanya.');
}
