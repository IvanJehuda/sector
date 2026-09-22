import { describe, expect, it } from 'vitest';
import { findBannedPhrases } from '@/lib/explain/guard';
import { CONFIDENCE_LABEL, LINK_TYPE_LABEL, modeLabel } from '@/lib/ui/labels';

describe('labels', () => {
  it('describes link types, confidence and mode in Indonesian', () => {
    expect(LINK_TYPE_LABEL.direct).toBe('Disebut langsung');
    expect(CONFIDENCE_LABEL.tinggi).toBe('Keyakinan tinggi');
    expect(modeLabel('retrospective')).toContain('Retrospektif');
    expect(modeLabel('prospective')).toContain('HIPOTESIS');
  });
  it('never contains banned phrases', () => {
    const all = [...Object.values(LINK_TYPE_LABEL), ...Object.values(CONFIDENCE_LABEL), modeLabel('retrospective'), modeLabel('prospective')];
    expect(findBannedPhrases(all.join(' '))).toEqual([]);
  });
});
