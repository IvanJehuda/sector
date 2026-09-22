import { normalizeSymbol, type EventInput } from '@/lib/domain';
import type { NewsArticle } from '@/lib/sectors/schemas';

export function newsToEvent(a: NewsArticle): EventInput {
  return {
    source: 'feed',
    url: a.source,
    title: a.title,
    body: a.body ?? '',
    publishedAt: a.timestamp,
    symbols: (a.symbols ?? []).map(normalizeSymbol),
    tags: a.tags ?? [],
    subSectors: a.sub_sector ?? [],
  };
}
