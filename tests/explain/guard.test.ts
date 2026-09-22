import { describe, expect, it } from 'vitest';
import { DISCLAIMER, findBannedPhrases } from '@/lib/explain/guard';

describe('findBannedPhrases', () => {
  it('flags advice words as whole words, case-insensitively', () => {
    expect(findBannedPhrases('Kami sarankan BELI sekarang')).toEqual(['beli']);
    expect(findBannedPhrases('Strong BUY signal')).toEqual(['buy']);
    expect(findBannedPhrases('target harga 5.000')).toEqual(['target harga']);
  });
  it('ignores words that merely contain a banned word', () => {
    expect(findBannedPhrases('Penjualan dan pembelian naik; shareholder senang')).toEqual([]);
  });
  it('allows the official foreign-flow phrases', () => {
    expect(findBannedPhrases('Investor asing mencatat net jual asing Rp 5 miliar dan net beli asing di BBCA')).toEqual([]);
  });
  it('disclaimer is exactly the spec text and passes the guard', () => {
    expect(DISCLAIMER).toBe(
      'Informasi ini adalah analisis data historis dan bukan saran investasi. Keterkaitan tidak berarti sebab-akibat. Keputusan investasi sepenuhnya tanggung jawab Anda.',
    );
    expect(findBannedPhrases(DISCLAIMER)).toEqual([]);
  });
});
