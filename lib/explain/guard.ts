export const DISCLAIMER =
  'Informasi ini adalah analisis data historis dan bukan saran investasi. Keterkaitan tidak berarti sebab-akibat. Keputusan investasi sepenuhnya tanggung jawab Anda.';

export const BANNED_PHRASES = [
  'beli',
  'jual',
  'rekomendasi',
  'target harga',
  'pasti naik',
  'pasti turun',
  'wajib',
  'buy',
  'sell',
  'hold',
  'akumulasi sekarang',
];

const ALLOWED_PHRASES = ['net jual asing', 'net beli asing'];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function findBannedPhrases(text: string): string[] {
  let t = text.toLowerCase();
  for (const allowed of ALLOWED_PHRASES) t = t.split(allowed).join(' ');
  return BANNED_PHRASES.filter((p) => new RegExp(`(^|[^a-z])${escapeRegExp(p)}([^a-z]|$)`).test(t));
}
