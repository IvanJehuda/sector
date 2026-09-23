import type { Confidence, LinkType, Mode } from '@/lib/domain';

export const LINK_TYPE_LABEL: Record<LinkType, string> = {
  direct: 'Disebut di berita',
  group: 'Satu grup usaha',
  index: 'Satu indeks saham',
  sector: 'Bidang usaha sama',
};

/** Confidence is rule-based evidence strength (lib/explain/confidence.ts), not how sure the AI is. */
export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  tinggi: 'Bukti kuat',
  sedang: 'Bukti sedang',
  rendah: 'Bukti lemah',
};

export function modeLabel(mode: Mode): string {
  return mode === 'retrospective' ? 'Retrospektif · reaksi pasar sudah terlihat' : 'HIPOTESIS · pasar belum bereaksi';
}
