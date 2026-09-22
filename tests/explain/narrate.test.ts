import { describe, expect, it } from 'vitest';
import { createFakeLlm } from '@/lib/agent/llm';
import { findBannedPhrases } from '@/lib/explain/guard';
import { narrate, templateNarrative, type NarrationInput } from '@/lib/explain/narrate';

const input: NarrationInput = {
  mode: 'retrospective',
  title: 'Asing jual saham bank',
  summary: 'Pemerintah mengumumkan kebijakan baru untuk bank BUMN.',
  ihsgReturn: -0.012,
  marketWide: false,
  findings: [
    { symbol: 'BBRI', name: 'Bank Rakyat Indonesia', linkType: 'direct', reason: 'Disebut langsung dalam berita', car: -0.072, significant: true, netForeignInflow: -5e11, confidence: 'tinggi' },
    { symbol: 'BBCA', name: 'Bank Central Asia', linkType: 'sector', reason: 'Subsektor Banks', car: null, significant: null, netForeignInflow: null, confidence: 'rendah' },
  ],
  analogs: [{ subSector: 'Banks', eventCount: 3, avgCar: -0.03 }],
};

describe('templateNarrative', () => {
  it('explains every finding and never uses banned phrases', () => {
    const n = templateNarrative(input);
    expect(n.explanations.map((e) => e.symbol)).toEqual(['BBRI', 'BBCA']);
    expect(n.explanations[0].text).toContain('-7,2%');
    expect(n.explanations[0].text).toContain('net jual asing');
    const all = [n.headline, ...n.chain, ...n.explanations.map((e) => e.text)].join(' ');
    expect(findBannedPhrases(all)).toEqual([]);
  });

  it('labels prospective narratives as hypotheses', () => {
    expect(templateNarrative({ ...input, mode: 'prospective' }).headline.startsWith('HIPOTESIS')).toBe(true);
  });
});

describe('narrate', () => {
  it('uses the LLM narrative and fills missing explanations from the template', async () => {
    const llm = createFakeLlm({
      narrative: { headline: 'Saham bank BUMN tertekan', chain: ['A', 'B'], explanations: [{ symbol: 'bbri.jk', text: 'Teks BBRI' }] },
    });
    const n = await narrate(llm, input);
    expect(n.headline).toBe('Saham bank BUMN tertekan');
    expect(n.explanations[0]).toEqual({ symbol: 'BBRI', text: 'Teks BBRI' });
    expect(n.explanations[1].text).toContain('Bank Central Asia');
    expect(JSON.parse(llm.calls[0].user)).toEqual(input);
  });

  it('retries once on banned phrases, then falls back to the template', async () => {
    const llm = createFakeLlm({ narrative: { headline: 'Saatnya beli', chain: [], explanations: [] } });
    const n = await narrate(llm, input);
    expect(llm.calls).toHaveLength(2);
    expect(n).toEqual(templateNarrative(input));
  });

  it('forces the HIPOTESIS prefix in prospective mode', async () => {
    const llm = createFakeLlm({ narrative: { headline: 'Bank berpotensi tertekan', chain: [], explanations: [] } });
    const n = await narrate(llm, { ...input, mode: 'prospective' });
    expect(n.headline).toBe('HIPOTESIS: Bank berpotensi tertekan');
  });

  it('falls back to the template when the LLM keeps failing', async () => {
    const llm = createFakeLlm({
      narrative: () => {
        throw new Error('down');
      },
    });
    expect(await narrate(llm, input)).toEqual(templateNarrative(input));
  });
});
