import type { LlmClient } from '@/lib/domain';
import type { NarrationInput } from '@/lib/explain/narrate';
import { createFakeLlm, createOpenAiLlm } from './llm';

/** Canned answers for LLM_MODE=fake (E2E and UI development). */
export const FAKE_LLM_RESPONSES = {
  event_profile: {
    summary: '(Contoh) Event ini menyangkut kebijakan untuk bank-bank BUMN.',
    event_type: 'kebijakan',
    themes: ['BUMN', 'perbankan'],
    mentioned_companies: [],
    sub_sectors: ['Banks'],
    index_hints: ['IDXBUMN20'],
    group_names: [],
    hypotheses: [{ sub_sector: 'Banks', direction: 'negatif', reason: '(Contoh) Ketidakpastian kebijakan.' }],
  },
  narrative: (user: string) => {
    const input = JSON.parse(user) as NarrationInput;
    return {
      headline: '(Contoh) Saham bank BUMN bereaksi terhadap kebijakan',
      chain: ['(Contoh) Kebijakan diumumkan.', '(Contoh) Pasar menilai ulang saham bank BUMN.'],
      explanations: input.findings.map((f) => ({ symbol: f.symbol, text: `(Contoh) Penjelasan untuk ${f.name}.` })),
    };
  },
};

export function llmFromEnv(): LlmClient {
  if ((process.env.LLM_MODE ?? 'openai') === 'fake') return createFakeLlm(FAKE_LLM_RESPONSES);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) throw new Error('OPENAI_API_KEY dan OPENAI_MODEL wajib diisi (atau set LLM_MODE=fake)');
  return createOpenAiLlm({ apiKey, model });
}
