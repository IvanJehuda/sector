import { describe, expect, it } from 'vitest';
import { findBannedPhrases } from '@/lib/explain/guard';
import {
  SHORT_DISCLAIMER,
  describeVsMarket,
  foreignFlowText,
  formatDateId,
  showReactionColumns,
  splitNewsInput,
  tone,
  unusualLabel,
} from '@/lib/ui/present';

describe('describeVsMarket', () => {
  it('says how far a stock moved relative to the market, in words', () => {
    expect(describeVsMarket(-0.041)).toBe('Turun 4,1% lebih dalam');
    expect(describeVsMarket(0.015)).toBe('Naik 1,5% lebih tinggi');
    expect(describeVsMarket(0.0004)).toBe('Sama dengan pasar');
  });
});

describe('unusualLabel', () => {
  it('maps significance to plain words', () => {
    expect(unusualLabel(true)).toBe('Tidak biasa');
    expect(unusualLabel(false)).toBe('Masih wajar');
  });
});

describe('foreignFlowText', () => {
  it('describes net foreign flow in rupiah without banned words', () => {
    const out = foreignFlowText(-120e9);
    expect(out).toBe('Investor asing lebih banyak menjual, Rp120 miliar');
    expect(foreignFlowText(8e9)).toBe('Investor asing lebih banyak membeli, Rp8 miliar');
    expect(foreignFlowText(0)).toBeNull();
    expect(foreignFlowText(null)).toBeNull();
    expect(findBannedPhrases(out ?? '')).toEqual([]);
  });

  it('keeps one decimal for small amounts', () => {
    expect(foreignFlowText(-2.5e9)).toBe('Investor asing lebih banyak menjual, Rp2,5 miliar');
  });
});

describe('formatDateId', () => {
  it('formats a YYYY-MM-DD date in Indonesian', () => {
    expect(formatDateId('2026-03-02')).toBe('2 Mar 2026');
  });
});

describe('splitNewsInput', () => {
  it('treats a lone http(s) address as a link', () => {
    expect(splitNewsInput('  https://contoh.id/berita  ')).toEqual({ url: 'https://contoh.id/berita' });
  });

  it('treats anything else as pasted text', () => {
    expect(splitNewsInput('Pemerintah umumkan https://x.id kebijakan baru')).toEqual({
      text: 'Pemerintah umumkan https://x.id kebijakan baru',
    });
  });

  it('returns nothing for blank input', () => {
    expect(splitNewsInput('   ')).toEqual({});
  });
});

describe('SHORT_DISCLAIMER', () => {
  it('says it is not investment advice and passes the guard', () => {
    expect(SHORT_DISCLAIMER).toContain('bukan saran investasi');
    expect(findBannedPhrases(SHORT_DISCLAIMER)).toEqual([]);
  });
});

describe('tone', () => {
  it('colours a move by its sign', () => {
    expect(tone(-0.01)).toBe('text-down');
    expect(tone(0.01)).toBe('text-up');
    expect(tone(0)).toBe('');
  });
});

describe('showReactionColumns', () => {
  const reaction = { t0: '2026-03-09', tEnd: '2026-03-16', days: 6, car: -0.05, marketReturn: 0.001, sigma: 0.01, zScore: -3, significant: true };

  it('shows price columns when at least one stock has a measured reaction', () => {
    expect(showReactionColumns([{ reaction: null }, { reaction }])).toBe(true);
  });

  it('hides them when no stock has one, as on every hypothesis report', () => {
    expect(showReactionColumns([{ reaction: null }, { reaction: null }])).toBe(false);
    expect(showReactionColumns([])).toBe(false);
  });
});
