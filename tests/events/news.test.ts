import { describe, expect, it } from 'vitest';
import { newsToEvent } from '@/lib/events/news';

describe('newsToEvent', () => {
  it('maps a Sectors news article to a feed event', () => {
    expect(
      newsToEvent({
        title: 'Judul',
        body: 'Isi',
        source: 'https://example.com/n1',
        timestamp: '2026-07-09T18:05:00',
        sector: 'financials',
        sub_sector: ['insurance'],
        tags: ['Bearish'],
        symbols: ['bbri.jk'],
      }),
    ).toEqual({
      source: 'feed',
      url: 'https://example.com/n1',
      title: 'Judul',
      body: 'Isi',
      publishedAt: '2026-07-09T18:05:00',
      symbols: ['BBRI'],
      tags: ['Bearish'],
      subSectors: ['insurance'],
    });
  });

  it('tolerates missing optional fields', () => {
    const e = newsToEvent({ title: 'T', source: 'https://example.com/n2', timestamp: '2026-07-09T08:00:00', body: null, symbols: null, tags: null, sub_sector: null });
    expect(e).toMatchObject({ body: '', symbols: [], tags: [], subSectors: [] });
  });
});
