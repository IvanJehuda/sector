import { z } from 'zod';
import type { EventInput, LlmClient } from '@/lib/domain';

export const EVENT_TYPES = ['kebijakan', 'makro', 'geopolitik', 'komoditas', 'korporasi', 'hukum', 'lainnya'] as const;
export const INDEX_HINTS = ['IDXBUMN20', 'LQ45', 'IDX30', 'JII70'] as const;
export const PROFILE_SCHEMA_NAME = 'event_profile';
const MAX_BODY_CHARS = 6000;

export const EventProfileSchema = z.object({
  summary: z.string(),
  event_type: z.enum(EVENT_TYPES),
  themes: z.array(z.string()),
  mentioned_companies: z.array(z.object({ name: z.string(), symbol: z.string().nullable() })),
  sub_sectors: z.array(z.string()),
  index_hints: z.array(z.enum(INDEX_HINTS)),
  group_names: z.array(z.string()),
  hypotheses: z.array(
    z.object({
      sub_sector: z.string(),
      direction: z.enum(['negatif', 'positif', 'tidak jelas']),
      reason: z.string(),
    }),
  ),
});

export type EventProfile = z.infer<typeof EventProfileSchema>;

export class ProfileExtractionError extends Error {
  constructor(cause: unknown) {
    super('Gagal mengekstrak profil event dari LLM', { cause });
    this.name = 'ProfileExtractionError';
  }
}

const SYSTEM = [
  'Kamu analis riset pasar modal Indonesia. Tugasmu membaca berita/event dan memetakan keterkaitannya dengan emiten Bursa Efek Indonesia (IDX).',
  'Aturan:',
  '1. Ini alat informasi, bukan saran investasi. Jangan pernah memakai kata beli, jual, rekomendasi, target harga, pasti naik, atau pasti turun.',
  '2. sub_sectors: pilih HANYA dari DAFTAR SUBSEKTOR yang diberikan, tulis persis sama. Pilih subsektor yang terdampak langsung, termasuk lewat komoditas, regulasi, atau makroekonomi (misalnya suku bunga ke Banks).',
  '3. mentioned_companies: hanya perusahaan yang benar-benar disebut di teks. Isi symbol hanya kalau kamu yakin kode saham 4 hurufnya, selain itu null.',
  '4. index_hints: isi IDXBUMN20 kalau event menyangkut BUMN secara umum. Kosongkan kalau tidak relevan.',
  '5. group_names: nama grup konglomerasi yang disebut (misalnya Salim, Djarum, Sinar Mas), dalam bentuk nama singkat.',
  '6. hypotheses: arah dampak per subsektor dengan alasan satu kalimat. Gunakan "tidak jelas" kalau ragu.',
  '7. summary: ringkasan netral 1–2 kalimat dalam bahasa Indonesia.',
].join('\n');

export function buildProfilePrompt(event: EventInput, allowedSubSectors: string[]): { system: string; user: string } {
  const user = [
    `JUDUL: ${event.title}`,
    `WAKTU TERBIT: ${event.publishedAt}`,
    `TAG: ${event.tags.join(', ') || '-'}`,
    `SAHAM DISEBUT OLEH SUMBER: ${event.symbols.join(', ') || '-'}`,
    '',
    'ISI:',
    event.body.slice(0, MAX_BODY_CHARS),
    '',
    'DAFTAR SUBSEKTOR:',
    ...allowedSubSectors,
  ].join('\n');
  return { system: SYSTEM, user };
}

function canonicalize(values: string[], allowed: string[]): string[] {
  const byLower = new Map(allowed.map((a) => [a.toLowerCase(), a]));
  const out: string[] = [];
  for (const v of values) {
    const canonical = byLower.get(v.trim().toLowerCase());
    if (canonical && !out.includes(canonical)) out.push(canonical);
  }
  return out;
}

export async function extractEventProfile(
  llm: LlmClient,
  event: EventInput,
  allowedSubSectors: string[],
): Promise<EventProfile> {
  const { system, user } = buildProfilePrompt(event, allowedSubSectors);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await llm.parse({ schema: EventProfileSchema, name: PROFILE_SCHEMA_NAME, system, user });
      return {
        ...raw,
        sub_sectors: canonicalize(raw.sub_sectors, allowedSubSectors),
        hypotheses: raw.hypotheses.flatMap((h) => {
          const [canonical] = canonicalize([h.sub_sector], allowedSubSectors);
          return canonical ? [{ ...h, sub_sector: canonical }] : [];
        }),
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw new ProfileExtractionError(lastError);
}
