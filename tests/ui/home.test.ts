import { describe, expect, it } from 'vitest';
import type { StoredEvent } from '@/lib/domain';
import { findBannedPhrases } from '@/lib/explain/guard';
import {
  RECENT_REPORTS_LABEL,
  RECENT_REPORTS_LINK,
  RECENT_REPORTS_TITLE,
  excludeShown,
  symbolsLabel,
} from '@/lib/ui/home';

function event(id: string): StoredEvent {
  return {
    id,
    source: 'feed',
    url: `https://example.com/${id}`,
    title: `Berita ${id}`,
    body: 'Isi berita',
    publishedAt: '2026-10-02T08:00:00',
    symbols: [],
    tags: [],
    subSectors: [],
    status: 'new',
    statusMessage: null,
    createdAt: '2026-10-02T08:00:00.000Z',
    statusUpdatedAt: null,
  };
}

describe('excludeShown', () => {
  it('drops events already shown elsewhere and keeps the feed order', () => {
    const feed = [event('a'), event('b'), event('c'), event('d')];
    expect(excludeShown(feed, [event('c'), event('a')]).map((e) => e.id)).toEqual(['b', 'd']);
  });

  it('returns the feed unchanged when nothing is shown', () => {
    const feed = [event('a'), event('b')];
    expect(excludeShown(feed, []).map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('symbolsLabel', () => {
  it('shows a dash when the event has no symbols', () => {
    expect(symbolsLabel([])).toBe('—');
  });

  it('joins up to four symbols', () => {
    expect(symbolsLabel(['BBRI', 'BMRI'])).toBe('BBRI · BMRI');
    expect(symbolsLabel(['BBRI', 'BMRI', 'BBNI', 'BRIS'])).toBe('BBRI · BMRI · BBNI · BRIS');
  });

  it('counts the symbols it leaves out', () => {
    expect(symbolsLabel(['LSIP', 'SIMP', 'INDF', 'AUTO', 'AALI', 'UNTR'])).toBe('LSIP · SIMP · INDF · AUTO +2');
    expect(symbolsLabel(['A', 'B', 'C'], 2)).toBe('A · B +1');
  });
});

describe('recent reports copy', () => {
  it('stays clear of investment-advice wording', () => {
    for (const text of [RECENT_REPORTS_LABEL, RECENT_REPORTS_TITLE, RECENT_REPORTS_LINK]) {
      expect(findBannedPhrases(text)).toEqual([]);
    }
  });
});
