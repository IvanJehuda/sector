import type { Confidence, LinkType, Mode } from '@/lib/domain';

export const LINK_TYPE_LABEL: Record<LinkType, string> = {
  direct: 'Disebut langsung',
  group: 'Grup usaha',
  index: 'Anggota indeks',
  sector: 'Subsektor',
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  tinggi: 'Keyakinan tinggi',
  sedang: 'Keyakinan sedang',
  rendah: 'Keyakinan rendah',
};

export function modeLabel(mode: Mode): string {
  return mode === 'retrospective'
    ? 'Retrospektif, berdasarkan reaksi pasar'
    : 'HIPOTESIS, belum ada hari bursa setelah event';
}
