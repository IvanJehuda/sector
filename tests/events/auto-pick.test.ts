import { describe, expect, it } from 'vitest';
import type { EventStatus, StoredEvent } from '@/lib/domain';
import { pickAutoAnalysis, tagSlug } from '@/lib/events/auto-pick';

const TODAY = '2026-10-05';

function event(id: string, publishedAt: string, tags: string[], status: EventStatus = 'new'): StoredEvent {
  return {
    id,
    source: 'feed',
    url: `https://example.com/${id}`,
    title: `Berita ${id}`,
    body: 'Isi berita',
    publishedAt,
    symbols: [],
    tags,
    subSectors: [],
    status,
    statusMessage: null,
    createdAt: '2026-10-05T01:00:00.000Z',
    statusUpdatedAt: null,
  };
}

describe('tagSlug', () => {
  it('turns Sectors display tags into their slugs', () => {
    expect(tagSlug('Politics & Regulation')).toBe('politics-regulation');
    expect(tagSlug('Government Policy')).toBe('government-policy');
    expect(tagSlug('OJK')).toBe('ojk');
    expect(tagSlug('Tariff & VAT')).toBe('tariff-vat');
  });
});

describe('pickAutoAnalysis', () => {
  it('picks the newest unanalysed policy article dated before today', () => {
    const older = event('older', '2026-10-01T09:00:00', ['Government Policy']);
    const newer = event('newer', '2026-10-02T09:00:00', ['Politics & Regulation']);
    expect(pickAutoAnalysis([older, newer], TODAY)?.id).toBe('newer');
  });

  it('ignores articles without a policy tag', () => {
    const corporate = event('corporate', '2026-10-02T09:00:00', ['Dividend Announcement', 'Bullish']);
    expect(pickAutoAnalysis([corporate], TODAY)).toBeNull();
  });

  it("leaves today's articles for tomorrow, so the report can carry a price reaction", () => {
    const today = event('today', `${TODAY}T09:00:00`, ['OJK']);
    expect(pickAutoAnalysis([today], TODAY)).toBeNull();
  });

  it('treats an article published after the market close as the next trading day', () => {
    const lastEvening = event('evening', '2026-10-04T17:00:00', ['OJK']);
    expect(pickAutoAnalysis([lastEvening], TODAY)).toBeNull();
  });

  it('only picks articles nobody has analysed or tried yet', () => {
    const done = event('done', '2026-10-02T09:00:00', ['OJK'], 'done');
    const analyzing = event('analyzing', '2026-10-02T09:00:00', ['OJK'], 'analyzing');
    const failed = event('failed', '2026-10-02T09:00:00', ['OJK'], 'failed');
    expect(pickAutoAnalysis([done, analyzing, failed], TODAY)).toBeNull();
  });

  it('skips an article whose date cannot be read instead of throwing', () => {
    const broken = event('broken', 'not a date', ['OJK']);
    const fine = event('fine', '2026-10-01T09:00:00', ['OJK']);
    expect(pickAutoAnalysis([broken, fine], TODAY)?.id).toBe('fine');
  });
});
