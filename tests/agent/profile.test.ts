import { describe, expect, it } from 'vitest';
import { createFakeLlm } from '@/lib/agent/llm';
import { buildProfilePrompt, extractEventProfile, ProfileExtractionError, type EventProfile } from '@/lib/agent/profile';
import type { EventInput } from '@/lib/domain';

const event: EventInput = {
  source: 'manual',
  url: null,
  title: 'Presiden umumkan restrukturisasi bank BUMN',
  body: 'Pemerintah akan menggabungkan beberapa bank BUMN ...',
  publishedAt: '2026-03-07T09:00:00',
  symbols: ['BBRI'],
  tags: ['Politics & Regulation'],
  subSectors: [],
};
const ALLOWED = ['Banks', 'Oil, Gas & Coal'];

const profile: EventProfile = {
  summary: 'Pemerintah berencana merestrukturisasi bank BUMN.',
  event_type: 'kebijakan',
  themes: ['BUMN', 'perbankan'],
  mentioned_companies: [{ name: 'Bank Rakyat Indonesia', symbol: 'BBRI' }],
  sub_sectors: ['banks', 'Tidak Ada'],
  index_hints: ['IDXBUMN20'],
  group_names: [],
  hypotheses: [
    { sub_sector: 'BANKS', direction: 'negatif', reason: 'Ketidakpastian struktur.' },
    { sub_sector: 'Fiksi', direction: 'positif', reason: 'x' },
  ],
};

describe('buildProfilePrompt', () => {
  it('includes the title, source symbols, body and the allowed sub-sector list', () => {
    const { system, user } = buildProfilePrompt(event, ALLOWED);
    expect(system).toContain('bukan saran investasi');
    expect(user).toContain('JUDUL: Presiden umumkan restrukturisasi bank BUMN');
    expect(user).toContain('SAHAM DISEBUT OLEH SUMBER: BBRI');
    expect(user).toContain('DAFTAR SUBSEKTOR:\nBanks\nOil, Gas & Coal');
  });
});

describe('extractEventProfile', () => {
  it('canonicalizes sub-sectors and drops unknown ones', async () => {
    const llm = createFakeLlm({ event_profile: profile });
    const out = await extractEventProfile(llm, event, ALLOWED);
    expect(out.sub_sectors).toEqual(['Banks']);
    expect(out.hypotheses).toEqual([{ sub_sector: 'Banks', direction: 'negatif', reason: 'Ketidakpastian struktur.' }]);
  });

  it('retries once after a failure', async () => {
    const llm = createFakeLlm({
      event_profile: (_u: string, i: number) => {
        if (i === 0) throw new Error('transient');
        return profile;
      },
    });
    expect((await extractEventProfile(llm, event, ALLOWED)).event_type).toBe('kebijakan');
    expect(llm.calls).toHaveLength(2);
  });

  it('throws ProfileExtractionError after two failures', async () => {
    const llm = createFakeLlm({ event_profile: { invalid: true } });
    await expect(extractEventProfile(llm, event, ALLOWED)).rejects.toBeInstanceOf(ProfileExtractionError);
  });
});
