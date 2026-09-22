# Correlation Explainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikasi web yang mengubah berita/event (feed Sectors otomatis atau link/teks yang ditempel) menjadi daftar saham IDX terkait beserta bukti reaksi pasar (retrospektif) atau pola historis (prospektif, berlabel HIPOTESIS), tanpa saran investasi.

**Architecture:** Next.js 15 full-stack TypeScript dalam satu repo. Logika domain ada di `lib/` dalam bentuk modul kecil dengan kontrak di `lib/domain.ts`: klien Sectors ber-cache dengan batas kredit, fungsi murni untuk analisis pasar, agent LLM (OpenAI structured outputs), explainer dengan penjaga kata, dan pipeline orkestrasi. Penyimpanan memakai SQLite lewat libSQL. Semua test berjalan tanpa API asli (fixture/fake).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript strict, zod 3, openai 5, @libsql/client, @mozilla/readability + linkedom, recharts, Tailwind, Vitest 2, Playwright, tsx, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-22-correlation-explainer-design.md` (baca dulu, terutama §4 data, §5 alur, dan §7 error).

## Global Constraints

- Node.js ≥ 20.12 (dibutuhkan untuk `process.loadEnvFile`), pnpm ≥ 9. Alias import `@/` = root repo.
- TypeScript `strict: true`. Tidak boleh ada `any` eksplisit.
- Versi dependency: `next@^15`, `zod@^3.23`, `openai@^5`, `@libsql/client@^0.14`, `@mozilla/readability@^0.5`, `linkedom@^0.18`, `recharts@^2.13`, `vitest@^2`, `@playwright/test@^1.48`, `tsx@^4`.
- **Test tidak pernah memanggil API asli.** Vitest berjalan dengan `SECTORS_MODE=fixture` dan `LLM_MODE=fake` (diatur di `vitest.config.ts`). E2E memakai `SECTORS_MODE=fake`.
- `SECTORS_MODE` ∈ `fixture` | `record` | `live` | `fake`. `fake` = data pasar sintetis untuk UI/E2E, tanpa kredit.
- Kode saham selalu dinormalisasi dengan `normalizeSymbol()`: huruf besar, tanpa `.JK`.
- Tanggal ditulis sebagai string `YYYY-MM-DD`. Zona waktu **WIB (UTC+7)**. Timestamp tanpa offset dianggap WIB. Event pukul ≥ 16:00 WIB dihitung ke hari berikutnya.
- Kredit: peringatan di ≥ 80% dan blokir di ≥ 90% dari `SECTORS_CREDIT_BUDGET` (default 1000). Sectors menagih untuk 2xx dan 404. 400/401/403/429/5xx gratis.
- Maksimal 6 kandidat dengan bukti harga (`MAX_EVIDENCE = 6`).
- Semua teks UI dan laporan dalam Bahasa Indonesia. Kata terlarang dan disclaimer disalin **persis** dari spec §7.
- Jangan pernah commit `.env*` (kecuali `.env.example`), `*.db`, atau API key.
- Setiap tugas selesai hanya kalau `pnpm test` dan `pnpm typecheck` lolos.

## Peta File

```
lib/
  domain.ts                 # Tipe dan kontrak bersama (Task 1)
  format.ts                 # formatPct, formatIdrBillion (Task 13)
  db/client.ts, migrate.ts, repo.ts            # Task 2
  sectors/keys.ts, budget.ts, stores.ts        # Task 3
  sectors/client.ts                            # Task 4
  sectors/schemas.ts, endpoints.ts, market-data.ts, from-env.ts   # Task 5
  sectors/fake.ts                              # Task 16
  market/dates.ts                              # Task 6
  market/reaction.ts, peers.ts                 # Task 7
  agent/llm.ts                                 # Task 9
  agent/profile.ts                             # Task 10
  agent/candidates.ts                          # Task 11
  agent/from-env.ts                            # Task 16
  explain/guard.ts, confidence.ts              # Task 12
  explain/narrate.ts                           # Task 13
  history/analogs.ts                           # Task 14
  events/article.ts, news.ts, manual.ts        # Task 15
  events/poll.ts                               # Task 17
  pipeline/analyze.ts, from-env.ts             # Task 16
  eval/score.ts                                # Task 21
  ui/labels.ts                                 # Task 19
app/
  api/analyze/route.ts, api/events/route.ts, api/events/[id]/route.ts, api/credits/route.ts   # Task 18
  api/cron/poll/route.ts                       # Task 17
  page.tsx, layout.tsx, events/[id]/page.tsx   # Task 19
components/  AnalyzeForm.tsx, AnalyzeFeedButton.tsx, Feed.tsx, CreditBanner.tsx, ReportView.tsx, Disclaimer.tsx   # Task 19
scripts/  record-fixtures.ts (T8), poll.ts (T17), seed-history.ts (T21), eval-golden.ts (T21)
fixtures/samples/*.json (T5)   fixtures/sectors/*.json (hasil rekam, T8)
data/golden-set.json (T21)
tests/ ... (mengikuti struktur lib/)   e2e/analyze.spec.ts (T20)
.github/workflows/ci.yml (T1), poll.yml (T22)
CLAUDE.md, README.md, .env.example
```

## Pembagian Kerja Paralel (tim 4 orang)

| Urutan | Orang 1: Data Sectors | Orang 2: Analisis Pasar | Orang 3: LLM & Explainer | Orang 4: Event & UI |
|---|---|---|---|---|
| Hari 1 (22–23 Sep) | **Task 1, 2** (satu orang, orang lain menunggu ±1 jam lalu pull) | | | |
| Hari 1–3 | Task 3 → 4 → 5 | Task 6 → 7 → 14 | Task 9 → 10 → 11 → 12 → 13 | Task 15, lalu komponen UI Task 19 memakai `makeReport()` dari `tests/helpers/factories.ts` |
| Hari 3 | Task 8 (rekam fixture, **butuh API key**) | | | |
| Hari 4 (25–26 Sep) | Task 16 (bersama Orang 3) → Task 17 | Task 21 | Task 16 | Task 18 → 19 |
| Hari 5–6 (27–28 Sep) | Seed histori (Task 21, live) | Golden set | Prompt tuning | Task 20, Task 22 |
| 29 Sep | Rekam video | | | |
| **30 Sep** | Submit sebelum 23:59 WIB. Repo dibekukan setelahnya | | | |

Setiap orang bekerja di **git worktree/branch sendiri** (`superpowers:using-git-worktrees`). Merge ke `main` lewat PR setelah CI hijau. **`lib/domain.ts` adalah kontrak.** Perubahan di sana wajib diumumkan ke seluruh tim.

---

### Task 1: Scaffold proyek, kontrak domain, CLAUDE.md, CI

**Files:**
- Create: (scaffold Next.js), `vitest.config.ts`, `lib/domain.ts`, `tests/domain.test.ts`, `CLAUDE.md`, `.env.example`, `.github/workflows/ci.yml`
- Modify: `.gitignore`, `package.json` (scripts), `next.config.ts`

**Interfaces:**
- Produces: seluruh tipe di `lib/domain.ts` (dipakai semua task), `normalizeSymbol(raw: string): string`, `todayWib(now?: Date): string`, `MarketData`, `LlmClient`.

- [ ] **Step 1: Scaffold Next.js di root repo**

Run:
```bash
pnpm dlx create-next-app@15 . --ts --app --eslint --tailwind --no-src-dir --import-alias "@/*" --use-pnpm --yes
```
Expected: file `package.json`, `app/`, `tsconfig.json`, `next.config.ts` muncul. Folder `docs/` tetap aman. Kalau create-next-app menolak karena folder tidak kosong, scaffold di folder sementara (`pnpm dlx create-next-app@15 ../ce-tmp ...` dengan flag yang sama), salin isinya ke root kecuali `.git`, lalu hapus folder sementara.

- [ ] **Step 2: Pasang dependency**

```bash
pnpm add zod@^3.23 openai@^5 @libsql/client@^0.14 @mozilla/readability@^0.5 linkedom@^0.18 recharts@^2.13
pnpm add -D vitest@^2 @playwright/test@^1.48 tsx@^4 @types/node
```

- [ ] **Step 3: Tambah script di package.json**

```bash
pnpm pkg set scripts.test="vitest run" scripts.test:watch="vitest" scripts.typecheck="tsc --noEmit" scripts.record="tsx scripts/record-fixtures.ts" scripts.poll="tsx scripts/poll.ts" scripts.seed:history="tsx scripts/seed-history.ts" scripts.eval="tsx scripts/eval-golden.ts" scripts.e2e="playwright test"
```

- [ ] **Step 4: Buat `vitest.config.ts`**

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: { SECTORS_MODE: 'fixture', LLM_MODE: 'fake' },
  },
});
```

- [ ] **Step 5: Ubah `next.config.ts`** supaya libSQL tidak di-bundle

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client', 'libsql'],
};

export default nextConfig;
```

- [ ] **Step 6: Tulis test yang gagal di `tests/domain.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeSymbol, todayWib } from '@/lib/domain';

describe('normalizeSymbol', () => {
  it('uppercases and strips the .JK suffix', () => {
    expect(normalizeSymbol('bbca.jk')).toBe('BBCA');
    expect(normalizeSymbol(' TLKM ')).toBe('TLKM');
    expect(normalizeSymbol('BBRI.JK')).toBe('BBRI');
  });
});

describe('todayWib', () => {
  it('returns the WIB calendar date', () => {
    expect(todayWib(new Date('2026-09-21T16:59:00Z'))).toBe('2026-09-21');
    expect(todayWib(new Date('2026-09-21T17:00:00Z'))).toBe('2026-09-22');
  });
});
```

- [ ] **Step 7: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/domain.test.ts`
Expected: FAIL, "Cannot find module '@/lib/domain'"

- [ ] **Step 8: Buat `lib/domain.ts`**

```ts
import type { ZodType } from 'zod';

export type LinkType = 'direct' | 'group' | 'index' | 'sector';
export type EventSource = 'feed' | 'manual';
export type Mode = 'retrospective' | 'prospective';
export type Confidence = 'tinggi' | 'sedang' | 'rendah';
export type EventStatus = 'new' | 'analyzing' | 'done' | 'failed';

export interface EventInput {
  source: EventSource;
  url: string | null;
  title: string;
  body: string;
  /** ISO timestamp or YYYY-MM-DD. Strings without an offset are treated as WIB. */
  publishedAt: string;
  symbols: string[];
  tags: string[];
  subSectors: string[];
}

export interface StoredEvent extends EventInput {
  id: string;
  status: EventStatus;
  statusMessage: string | null;
  createdAt: string;
}

export interface Company {
  symbol: string;
  name: string;
  subSector: string | null;
  marketCap: number | null;
}

export interface PricePoint {
  date: string;
  close: number;
}

export interface FlowPoint {
  date: string;
  netForeignInflow: number;
}

export interface Mover {
  symbol: string;
  name: string;
  priceChange: number;
  date: string;
}

export interface Candidate {
  symbol: string;
  name: string;
  subSector: string | null;
  marketCap: number | null;
  linkType: LinkType;
  reason: string;
  withEvidence: boolean;
}

export interface Reaction {
  t0: string;
  tEnd: string;
  days: number;
  /** Cumulative abnormal return vs IHSG over [t0, tEnd]. */
  car: number;
  marketReturn: number;
  sigma: number;
  zScore: number;
  significant: boolean;
}

export interface StockFinding {
  candidate: Candidate;
  reaction: Reaction | null;
  netForeignInflow: number | null;
  confidence: Confidence;
  explanation: string;
  dataNote: string | null;
}

export interface AnalogSummary {
  subSector: string;
  eventCount: number;
  avgCar: number;
}

export interface SubSectorSummary {
  subSector: string;
  avgCar: number;
  count: number;
}

export interface Report {
  eventId: string;
  mode: Mode;
  eventType: string;
  headline: string;
  chain: string[];
  market: { t0: string; ihsgReturn: number; marketWide: boolean } | null;
  findings: StockFinding[];
  subSectorSummary: SubSectorSummary[];
  otherLinks: Candidate[];
  unexplainedMovers: Mover[];
  analogs: AnalogSummary[];
  creditsUsed: number;
  disclaimer: string;
  createdAt: string;
}

/** Market data the pipeline needs. Implemented by lib/sectors (real) and lib/sectors/fake.ts. */
export interface MarketData {
  today(): string;
  universe(): Promise<Company[]>;
  daily(symbol: string, start: string, end: string): Promise<PricePoint[]>;
  ihsg(start: string, end: string): Promise<PricePoint[]>;
  foreignFlow(symbol: string, start: string, end: string): Promise<FlowPoint[]>;
  affiliates(symbol: string): Promise<string[]>;
  groupMembers(group: string): Promise<string[]>;
  indexMembers(code: string): Promise<string[]>;
  topLosers1d(): Promise<Mover[]>;
}

/** Structured-output LLM call. Implemented by lib/agent/llm.ts (OpenAI and fake). */
export interface LlmClient {
  parse<T>(args: { schema: ZodType<T>; name: string; system: string; user: string }): Promise<T>;
}

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/\.JK$/, '');
}

export function todayWib(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}
```

- [ ] **Step 9: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/domain.test.ts`
Expected: PASS (2 test)

- [ ] **Step 10: Tambahkan baris berikut di akhir `.gitignore`**

```gitignore
# Correlation Explainer
.env*
!.env.example
*.db
*.db-journal
.claude/worktrees/
test-results/
playwright-report/
```

- [ ] **Step 11: Buat `.env.example`**

```bash
SECTORS_API_KEY=
SECTORS_MODE=fixture
SECTORS_CREDIT_BUDGET=1000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
LLM_MODE=openai
DATABASE_URL=file:local.db
DATABASE_AUTH_TOKEN=
CRON_SECRET=
FAKE_SHOCK_DAY=
```

- [ ] **Step 12: Buat `CLAUDE.md`**

```markdown
# Correlation Explainer: Aturan untuk Coding Agent

Aplikasi Next.js 15 (TypeScript) untuk Sectors Hackathon 2026: berita/event → saham IDX terkait + bukti reaksi pasar.
Spec: docs/superpowers/specs/2026-09-22-correlation-explainer-design.md
Plan: docs/superpowers/plans/2026-09-22-correlation-explainer.md

## Perintah
- `pnpm test` (Vitest, fixture + fake LLM), `pnpm typecheck`, `pnpm lint`, `pnpm e2e`
- `pnpm dev` dengan `SECTORS_MODE=fake LLM_MODE=fake` untuk UI tanpa kredit

## Aturan wajib
1. JANGAN memanggil API Sectors asli dari test atau saat eksperimen. Pakai fixture (`fixtures/sectors/`) atau `SECTORS_MODE=fake`. Kredit tim hanya 1.000 untuk seluruh acara.
2. Semua akses Sectors lewat `lib/sectors/client.ts` (cache + pencatat kredit + batas budget). Jangan pernah memakai `fetch` langsung ke api.sectors.app.
3. `lib/domain.ts` adalah kontrak antar modul. Jangan mengubahnya tanpa persetujuan tim.
4. Tidak boleh ada saran investasi. Teks yang ditampilkan ke user wajib lolos `findBannedPhrases()` (lib/explain/guard.ts) dan menyertakan `DISCLAIMER`.
5. Modul kecil dengan satu tanggung jawab. Fungsi murni diletakkan di `lib/market`, `lib/explain`, dan `lib/history`.
6. TDD: tulis test dulu. Sebelum menyatakan selesai, jalankan `pnpm test && pnpm typecheck` dan tunjukkan hasilnya.
7. Teks UI dalam Bahasa Indonesia. Kode dan identifier dalam bahasa Inggris.
8. Jangan commit `.env*`, `*.db`, atau API key.
```

- [ ] **Step 13: Buat `.github/workflows/ci.yml`**

```yaml
name: ci
on:
  push:
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
```

- [ ] **Step 14: Verifikasi seluruh tooling**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: semua lolos.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app, domain contracts, CI and agent rules"
```

---

### Task 2: Lapisan database (libSQL)

**Files:**
- Create: `lib/db/client.ts`, `lib/db/migrate.ts`, `lib/db/repo.ts`, `tests/helpers/factories.ts`, `tests/db/repo.test.ts`

**Interfaces:**
- Consumes: tipe dari `lib/domain.ts`.
- Produces:
  - `type Db = Client` (`@libsql/client`), `createDb(url?: string, authToken?: string): Db`, `getDb(): Promise<Db>` (singleton yang sudah dimigrasi), `migrate(db: Db): Promise<void>`
  - `insertEvent(db, input: EventInput): Promise<{ event: StoredEvent; created: boolean }>` (dedup berdasarkan `url`)
  - `getEvent(db, id): Promise<StoredEvent | null>`, `listEvents(db, limit = 50): Promise<StoredEvent[]>`, `setEventStatus(db, id, status: EventStatus, message: string | null = null): Promise<void>`
  - `saveReport(db, report: Report)`, `getReport(db, eventId): Promise<Report | null>`, `listRetrospectiveReports(db): Promise<Report[]>`
  - `kvGet(db, key): Promise<string | null>`, `kvSet(db, key, value): Promise<void>`
  - Test helper: `makeCandidate()`, `makeReaction()`, `makeReport()`

- [ ] **Step 1: Buat helper test `tests/helpers/factories.ts`**

```ts
import type { Candidate, Reaction, Report } from '@/lib/domain';

export function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    symbol: 'BBRI',
    name: 'PT Bank Rakyat Indonesia (Persero) Tbk',
    subSector: 'Banks',
    marketCap: 6e14,
    linkType: 'sector',
    reason: 'Subsektor Banks',
    withEvidence: true,
    ...overrides,
  };
}

export function makeReaction(overrides: Partial<Reaction> = {}): Reaction {
  return {
    t0: '2026-09-01',
    tEnd: '2026-09-08',
    days: 6,
    car: -0.05,
    marketReturn: -0.01,
    sigma: 0.01,
    zScore: -2.04,
    significant: true,
    ...overrides,
  };
}

export function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    eventId: 'evt-1',
    mode: 'retrospective',
    eventType: 'kebijakan',
    headline: 'Bagaimana pasar bereaksi terhadap berita ini',
    chain: ['Pemerintah mengumumkan kebijakan baru.'],
    market: { t0: '2026-09-01', ihsgReturn: -0.01, marketWide: false },
    findings: [
      {
        candidate: makeCandidate(),
        reaction: makeReaction(),
        netForeignInflow: -5e9,
        confidence: 'sedang',
        explanation: 'Penjelasan contoh.',
        dataNote: null,
      },
    ],
    subSectorSummary: [{ subSector: 'Banks', avgCar: -0.05, count: 1 }],
    otherLinks: [],
    unexplainedMovers: [],
    analogs: [],
    creditsUsed: 0,
    disclaimer: 'Disclaimer contoh.',
    createdAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  };
}
```

- [ ] **Step 2: Tulis test yang gagal di `tests/db/repo.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import {
  getEvent,
  getReport,
  insertEvent,
  kvGet,
  kvSet,
  listEvents,
  listRetrospectiveReports,
  saveReport,
  setEventStatus,
} from '@/lib/db/repo';
import type { EventInput } from '@/lib/domain';
import { makeReport } from '../helpers/factories';

const input: EventInput = {
  source: 'manual',
  url: 'https://example.com/berita-a',
  title: 'Judul berita',
  body: 'Isi berita',
  publishedAt: '2026-09-01T10:00:00',
  symbols: ['BBRI'],
  tags: ['Politics & Regulation'],
  subSectors: ['Banks'],
};

let db: Db;
beforeEach(async () => {
  db = createDb(':memory:');
  await migrate(db);
});

describe('events', () => {
  it('inserts and reads back an event with status new', async () => {
    const { event, created } = await insertEvent(db, input);
    expect(created).toBe(true);
    const loaded = await getEvent(db, event.id);
    expect(loaded).toMatchObject({ ...input, status: 'new', statusMessage: null });
  });

  it('dedupes by url', async () => {
    const first = await insertEvent(db, input);
    const second = await insertEvent(db, { ...input, title: 'Lain' });
    expect(second.created).toBe(false);
    expect(second.event.id).toBe(first.event.id);
  });

  it('allows many events without url', async () => {
    await insertEvent(db, { ...input, url: null });
    await insertEvent(db, { ...input, url: null });
    expect(await listEvents(db)).toHaveLength(2);
  });

  it('updates status and message', async () => {
    const { event } = await insertEvent(db, input);
    await setEventStatus(db, event.id, 'failed', 'Gagal');
    expect(await getEvent(db, event.id)).toMatchObject({ status: 'failed', statusMessage: 'Gagal' });
  });
});

describe('reports', () => {
  it('saves, reads and lists only retrospective reports', async () => {
    await saveReport(db, makeReport({ eventId: 'a' }));
    await saveReport(db, makeReport({ eventId: 'b', mode: 'prospective' }));
    expect((await getReport(db, 'a'))?.eventId).toBe('a');
    expect(await getReport(db, 'zzz')).toBeNull();
    const retro = await listRetrospectiveReports(db);
    expect(retro.map((r) => r.eventId)).toEqual(['a']);
  });
});

describe('kv', () => {
  it('round-trips values', async () => {
    expect(await kvGet(db, 'k')).toBeNull();
    await kvSet(db, 'k', 'v1');
    await kvSet(db, 'k', 'v2');
    expect(await kvGet(db, 'k')).toBe('v2');
  });
});
```

- [ ] **Step 3: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/db/repo.test.ts`
Expected: FAIL, "Cannot find module '@/lib/db/client'"

- [ ] **Step 4: Buat `lib/db/migrate.ts`**

```ts
import type { Db } from './client';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  expires_at INTEGER
);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  path TEXT NOT NULL,
  cost INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  url TEXT UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TEXT NOT NULL,
  symbols TEXT NOT NULL,
  tags TEXT NOT NULL,
  sub_sectors TEXT NOT NULL,
  status TEXT NOT NULL,
  status_message TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  event_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  event_type TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export async function migrate(db: Db): Promise<void> {
  await db.executeMultiple(SCHEMA);
}
```

- [ ] **Step 5: Buat `lib/db/client.ts`**

```ts
import { createClient, type Client } from '@libsql/client';
import { migrate } from './migrate';

export type Db = Client;

export function createDb(
  url: string = process.env.DATABASE_URL ?? 'file:local.db',
  authToken: string | undefined = process.env.DATABASE_AUTH_TOKEN || undefined,
): Db {
  return createClient({ url, authToken });
}

let singleton: Promise<Db> | null = null;

/** Process-wide migrated database, configured from env. */
export function getDb(): Promise<Db> {
  if (!singleton) {
    singleton = (async () => {
      const db = createDb();
      await migrate(db);
      return db;
    })();
  }
  return singleton;
}
```

- [ ] **Step 6: Buat `lib/db/repo.ts`**

```ts
import { randomUUID } from 'node:crypto';
import type { Row } from '@libsql/client';
import type { EventInput, EventSource, EventStatus, Report, StoredEvent } from '@/lib/domain';
import type { Db } from './client';

function rowToEvent(r: Row): StoredEvent {
  return {
    id: String(r.id),
    source: String(r.source) as EventSource,
    url: r.url === null ? null : String(r.url),
    title: String(r.title),
    body: String(r.body),
    publishedAt: String(r.published_at),
    symbols: JSON.parse(String(r.symbols)) as string[],
    tags: JSON.parse(String(r.tags)) as string[],
    subSectors: JSON.parse(String(r.sub_sectors)) as string[],
    status: String(r.status) as EventStatus,
    statusMessage: r.status_message === null ? null : String(r.status_message),
    createdAt: String(r.created_at),
  };
}

export async function getEvent(db: Db, id: string): Promise<StoredEvent | null> {
  const r = await db.execute({ sql: 'SELECT * FROM events WHERE id = ?', args: [id] });
  return r.rows[0] ? rowToEvent(r.rows[0]) : null;
}

export async function insertEvent(
  db: Db,
  input: EventInput,
): Promise<{ event: StoredEvent; created: boolean }> {
  if (input.url) {
    const existing = await db.execute({ sql: 'SELECT * FROM events WHERE url = ?', args: [input.url] });
    if (existing.rows[0]) return { event: rowToEvent(existing.rows[0]), created: false };
  }
  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO events (id, source, url, title, body, published_at, symbols, tags, sub_sectors, status, status_message, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', NULL, ?)`,
    args: [
      id,
      input.source,
      input.url,
      input.title,
      input.body,
      input.publishedAt,
      JSON.stringify(input.symbols),
      JSON.stringify(input.tags),
      JSON.stringify(input.subSectors),
      new Date().toISOString(),
    ],
  });
  const event = await getEvent(db, id);
  if (!event) throw new Error('insertEvent: row missing after insert');
  return { event, created: true };
}

export async function listEvents(db: Db, limit = 50): Promise<StoredEvent[]> {
  const r = await db.execute({ sql: 'SELECT * FROM events ORDER BY published_at DESC LIMIT ?', args: [limit] });
  return r.rows.map(rowToEvent);
}

export async function setEventStatus(
  db: Db,
  id: string,
  status: EventStatus,
  message: string | null = null,
): Promise<void> {
  await db.execute({ sql: 'UPDATE events SET status = ?, status_message = ? WHERE id = ?', args: [status, message, id] });
}

export async function saveReport(db: Db, report: Report): Promise<void> {
  await db.execute({
    sql: 'INSERT OR REPLACE INTO reports (event_id, mode, event_type, body, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [report.eventId, report.mode, report.eventType, JSON.stringify(report), report.createdAt],
  });
}

export async function getReport(db: Db, eventId: string): Promise<Report | null> {
  const r = await db.execute({ sql: 'SELECT body FROM reports WHERE event_id = ?', args: [eventId] });
  return r.rows[0] ? (JSON.parse(String(r.rows[0].body)) as Report) : null;
}

export async function listRetrospectiveReports(db: Db): Promise<Report[]> {
  const r = await db.execute("SELECT body FROM reports WHERE mode = 'retrospective'");
  return r.rows.map((row) => JSON.parse(String(row.body)) as Report);
}

export async function kvGet(db: Db, key: string): Promise<string | null> {
  const r = await db.execute({ sql: 'SELECT value FROM kv WHERE key = ?', args: [key] });
  return r.rows[0] ? String(r.rows[0].value) : null;
}

export async function kvSet(db: Db, key: string, value: string): Promise<void> {
  await db.execute({ sql: 'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', args: [key, value] });
}
```

- [ ] **Step 7: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/db/repo.test.ts && pnpm typecheck`
Expected: PASS (6 test), typecheck bersih.

- [ ] **Step 8: Commit**

```bash
git add lib/db tests/db tests/helpers
git commit -m "feat(db): libSQL schema, migrations and repositories"
```

---
### Task 3: Kunci cache, budget kredit, dan penyimpanan cache/ledger

**Files:**
- Create: `lib/sectors/keys.ts`, `lib/sectors/budget.ts`, `lib/sectors/stores.ts`, `tests/sectors/keys.test.ts`, `tests/sectors/budget.test.ts`, `tests/sectors/stores.test.ts`

**Interfaces:**
- Consumes: `Db`, `createDb`, `migrate` (Task 2).
- Produces:
  - `type QueryParams = Record<string, string | number | boolean | undefined>`, `canonicalQuery(params): string`, `cacheKey(path, params): string`, `fixtureFileName(key): string`
  - `type BudgetState = 'ok' | 'warn' | 'blocked'`, `WARN_RATIO = 0.8`, `BLOCK_RATIO = 0.9`, `budgetState(used, budget): BudgetState`, `canSpend(used, cost, budget): boolean`, `class CreditBudgetError`
  - `interface CacheStore { get(key, now): Promise<string | null>; set(key, body, expiresAt: number | null): Promise<void> }`
  - `interface CreditLedger { total(): Promise<number>; record(path, cost): Promise<void> }`
  - `memoryCache()`, `memoryLedger(initial = 0)`, `dbCache(db)`, `dbLedger(db)`

- [ ] **Step 1: Tulis test yang gagal**

`tests/sectors/keys.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { cacheKey, canonicalQuery, fixtureFileName } from '@/lib/sectors/keys';

describe('canonicalQuery', () => {
  it('sorts keys, drops undefined and encodes values', () => {
    expect(canonicalQuery({ b: 2, a: 'x y', c: undefined })).toBe('a=x%20y&b=2');
  });
});

describe('cacheKey', () => {
  it('is independent of param order', () => {
    expect(cacheKey('/v2/daily/BBCA/', { end: '2026-01-31', start: '2026-01-01' })).toBe(
      cacheKey('/v2/daily/BBCA/', { start: '2026-01-01', end: '2026-01-31' }),
    );
  });
  it('omits the question mark when there are no params', () => {
    expect(cacheKey('/v2/subsectors/', {})).toBe('/v2/subsectors/');
  });
});

describe('fixtureFileName', () => {
  it('is readable, stable and unique per key', () => {
    const a = fixtureFileName('/v2/daily/BBCA/?end=2026-01-31&start=2026-01-01');
    const b = fixtureFileName('/v2/daily/BBCA/?end=2026-02-28&start=2026-02-01');
    expect(a).toMatch(/^v2_daily_BBCA__[0-9a-f]{10}\.json$/);
    expect(a).toBe(fixtureFileName('/v2/daily/BBCA/?end=2026-01-31&start=2026-01-01'));
    expect(a).not.toBe(b);
  });
});
```

`tests/sectors/budget.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { budgetState, canSpend } from '@/lib/sectors/budget';

describe('budgetState', () => {
  it('is ok below 80%, warn from 80%, blocked from 90%', () => {
    expect(budgetState(0, 1000)).toBe('ok');
    expect(budgetState(799, 1000)).toBe('ok');
    expect(budgetState(800, 1000)).toBe('warn');
    expect(budgetState(900, 1000)).toBe('blocked');
  });
});

describe('canSpend', () => {
  it('allows spending up to the 90% line only', () => {
    expect(canSpend(899, 1, 1000)).toBe(true);
    expect(canSpend(899, 2, 1000)).toBe(false);
  });
});
```

`tests/sectors/stores.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createDb } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import { dbCache, dbLedger, memoryCache, memoryLedger, type CacheStore, type CreditLedger } from '@/lib/sectors/stores';

async function freshDb() {
  const db = createDb(':memory:');
  await migrate(db);
  return db;
}

const caches: Array<[string, () => Promise<CacheStore>]> = [
  ['memory', async () => memoryCache()],
  ['db', async () => dbCache(await freshDb())],
];
const ledgers: Array<[string, () => Promise<CreditLedger>]> = [
  ['memory', async () => memoryLedger()],
  ['db', async () => dbLedger(await freshDb())],
];

describe.each(caches)('%s cache', (_name, make) => {
  it('returns stored bodies until they expire', async () => {
    const cache = await make();
    await cache.set('k', 'body', 1_000);
    expect(await cache.get('k', 999)).toBe('body');
    expect(await cache.get('k', 1_000)).toBeNull();
  });
  it('keeps entries without expiry forever', async () => {
    const cache = await make();
    await cache.set('k', 'body', null);
    expect(await cache.get('k', Number.MAX_SAFE_INTEGER)).toBe('body');
    expect(await cache.get('missing', 0)).toBeNull();
  });
});

describe.each(ledgers)('%s ledger', (_name, make) => {
  it('sums recorded costs', async () => {
    const ledger = await make();
    expect(await ledger.total()).toBe(0);
    await ledger.record('/v2/daily/BBCA/', 1);
    await ledger.record('/v2/companies/top-changes/', 2);
    expect(await ledger.total()).toBe(3);
  });
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/sectors`
Expected: FAIL, modul `@/lib/sectors/*` tidak ditemukan.

- [ ] **Step 3: Buat `lib/sectors/keys.ts`**

```ts
import { createHash } from 'node:crypto';

export type QueryParams = Record<string, string | number | boolean | undefined>;

export function canonicalQuery(params: QueryParams): string {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
    .join('&');
}

export function cacheKey(path: string, params: QueryParams): string {
  const q = canonicalQuery(params);
  return q ? `${path}?${q}` : path;
}

export function fixtureFileName(key: string): string {
  const [pathPart] = key.split('?');
  const slug = pathPart.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 10);
  return `${slug}__${hash}.json`;
}
```

- [ ] **Step 4: Buat `lib/sectors/budget.ts`**

```ts
export type BudgetState = 'ok' | 'warn' | 'blocked';

export const WARN_RATIO = 0.8;
export const BLOCK_RATIO = 0.9;

export function budgetState(used: number, budget: number): BudgetState {
  if (used >= budget * BLOCK_RATIO) return 'blocked';
  if (used >= budget * WARN_RATIO) return 'warn';
  return 'ok';
}

export function canSpend(used: number, cost: number, budget: number): boolean {
  return used + cost <= budget * BLOCK_RATIO;
}

export class CreditBudgetError extends Error {
  constructor(
    public readonly used: number,
    public readonly cost: number,
    public readonly budget: number,
  ) {
    super(`Sectors credit budget exhausted: ${used} used + ${cost} requested > ${budget * BLOCK_RATIO} allowed`);
    this.name = 'CreditBudgetError';
  }
}
```

- [ ] **Step 5: Buat `lib/sectors/stores.ts`**

```ts
import type { Db } from '@/lib/db/client';

export interface CacheStore {
  get(key: string, now: number): Promise<string | null>;
  set(key: string, body: string, expiresAt: number | null): Promise<void>;
}

export interface CreditLedger {
  total(): Promise<number>;
  record(path: string, cost: number): Promise<void>;
}

export function memoryCache(): CacheStore {
  const entries = new Map<string, { body: string; expiresAt: number | null }>();
  return {
    async get(key, now) {
      const e = entries.get(key);
      if (!e) return null;
      if (e.expiresAt !== null && e.expiresAt <= now) return null;
      return e.body;
    },
    async set(key, body, expiresAt) {
      entries.set(key, { body, expiresAt });
    },
  };
}

export function memoryLedger(initial = 0): CreditLedger {
  let total = initial;
  return {
    async total() {
      return total;
    },
    async record(_path, cost) {
      total += cost;
    },
  };
}

export function dbCache(db: Db): CacheStore {
  return {
    async get(key, now) {
      const r = await db.execute({ sql: 'SELECT body, expires_at FROM api_cache WHERE key = ?', args: [key] });
      const row = r.rows[0];
      if (!row) return null;
      const expiresAt = row.expires_at === null ? null : Number(row.expires_at);
      if (expiresAt !== null && expiresAt <= now) return null;
      return String(row.body);
    },
    async set(key, body, expiresAt) {
      await db.execute({
        sql: 'INSERT OR REPLACE INTO api_cache (key, body, expires_at) VALUES (?, ?, ?)',
        args: [key, body, expiresAt],
      });
    },
  };
}

export function dbLedger(db: Db): CreditLedger {
  return {
    async total() {
      const r = await db.execute('SELECT COALESCE(SUM(cost), 0) AS total FROM credit_ledger');
      return Number(r.rows[0]?.total ?? 0);
    },
    async record(path, cost) {
      await db.execute({
        sql: 'INSERT INTO credit_ledger (at, path, cost) VALUES (?, ?, ?)',
        args: [new Date().toISOString(), path, cost],
      });
    },
  };
}
```

- [ ] **Step 6: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/sectors && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/sectors tests/sectors
git commit -m "feat(sectors): cache keys, credit budget rules, cache and ledger stores"
```

---

### Task 4: Klien HTTP Sectors (fixture / record / live)

**Files:**
- Create: `lib/sectors/client.ts`, `tests/sectors/client.test.ts`

**Interfaces:**
- Consumes: `cacheKey`, `canonicalQuery`, `fixtureFileName`, `QueryParams`, `canSpend`, `CreditBudgetError`, `CacheStore`, `CreditLedger` (Task 3).
- Produces:
  - `type SectorsMode = 'fixture' | 'record' | 'live'`
  - `class FixtureMissingError`, `class SectorsHttpError { status: number; path: string }`
  - `interface GetOptions { cost: number; ttlSeconds: number | null }` (`null` = permanen)
  - `interface SectorsClient { get<T>(path: string, params: QueryParams, schema: ZodType<T>, opts: GetOptions): Promise<T> }`
  - `createSectorsClient(options: SectorsClientOptions): SectorsClient`
  - Format file fixture: `{ "key": "<cacheKey>", "data": <response JSON mentah> }`

Perilaku yang wajib: mode `fixture` hanya membaca file dan **tidak pernah** memanggil fetch. Mode `live`/`record` memakai cache dulu, lalu fetch. Budget dicek sebelum fetch. 429 di-retry maksimal 3× (jeda 1 dtk, 2 dtk, 4 dtk). 5xx di-retry 1× (jeda 1 dtk). Ledger mencatat biaya untuk 2xx dan 404 saja. Mode `record` menulis fixture untuk setiap response, termasuk yang berasal dari cache.

- [ ] **Step 1: Tulis test yang gagal di `tests/sectors/client.test.ts`**

```ts
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CreditBudgetError } from '@/lib/sectors/budget';
import { createSectorsClient, FixtureMissingError, SectorsHttpError, type SectorsMode } from '@/lib/sectors/client';
import { cacheKey, fixtureFileName } from '@/lib/sectors/keys';
import { memoryCache, memoryLedger } from '@/lib/sectors/stores';

const Schema = z.object({ ok: z.boolean() });
const OPTS = { cost: 1, ttlSeconds: 60 };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function setup(mode: SectorsMode, opts: { ledgerStart?: number; now?: () => number } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sectors-fx-'));
  const ledger = memoryLedger(opts.ledgerStart ?? 0);
  const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => json({ ok: true }));
  const client = createSectorsClient({
    mode,
    apiKey: 'test-key',
    fixturesDir: dir,
    cache: memoryCache(),
    ledger,
    budget: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep: async () => {},
    now: opts.now,
  });
  return { dir, ledger, fetchImpl, client };
}

describe('fixture mode', () => {
  it('reads the fixture file and never calls fetch', async () => {
    const { dir, fetchImpl, client } = await setup('fixture');
    const key = cacheKey('/v2/x/', { a: 1 });
    await writeFile(path.join(dir, fixtureFileName(key)), JSON.stringify({ key, data: { ok: true } }));
    expect(await client.get('/v2/x/', { a: 1 }, Schema, OPTS)).toEqual({ ok: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws FixtureMissingError when no fixture exists', async () => {
    const { client } = await setup('fixture');
    await expect(client.get('/v2/x/', {}, Schema, OPTS)).rejects.toBeInstanceOf(FixtureMissingError);
  });
});

describe('live mode', () => {
  it('fetches with the API key, records the cost and caches the result', async () => {
    const { fetchImpl, ledger, client } = await setup('live');
    await client.get('/v2/x/', { a: 1 }, Schema, OPTS);
    await client.get('/v2/x/', { a: 1 }, Schema, OPTS);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.sectors.app/v2/x/?a=1', {
      headers: { Authorization: 'test-key' },
    });
    expect(await ledger.total()).toBe(1);
  });

  it('refetches after the cache entry expires', async () => {
    let t = 0;
    const { fetchImpl, client } = await setup('live', { now: () => t });
    await client.get('/v2/x/', {}, Schema, OPTS);
    t = 61_000;
    await client.get('/v2/x/', {}, Schema, OPTS);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries 429 and charges once', async () => {
    const { fetchImpl, ledger, client } = await setup('live');
    fetchImpl
      .mockImplementationOnce(async () => json({ error: 'RATE_LIMIT_EXCEEDED' }, 429))
      .mockImplementationOnce(async () => json({ error: 'RATE_LIMIT_EXCEEDED' }, 429));
    expect(await client.get('/v2/x/', {}, Schema, OPTS)).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(await ledger.total()).toBe(1);
  });

  it('retries a 5xx once', async () => {
    const { fetchImpl, client } = await setup('live');
    fetchImpl.mockImplementationOnce(async () => json({ error: 'boom' }, 503));
    expect(await client.get('/v2/x/', {}, Schema, OPTS)).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not charge for 400', async () => {
    const { fetchImpl, ledger, client } = await setup('live');
    fetchImpl.mockImplementationOnce(async () => json({ error: 'bad' }, 400));
    await expect(client.get('/v2/x/', {}, Schema, OPTS)).rejects.toBeInstanceOf(SectorsHttpError);
    expect(await ledger.total()).toBe(0);
  });

  it('charges for 404', async () => {
    const { fetchImpl, ledger, client } = await setup('live');
    fetchImpl.mockImplementationOnce(async () => json({ error: 'nope' }, 404));
    await expect(client.get('/v2/x/', {}, Schema, OPTS)).rejects.toMatchObject({ status: 404 });
    expect(await ledger.total()).toBe(1);
  });

  it('blocks calls past 90% of the budget without fetching', async () => {
    const { fetchImpl, client } = await setup('live', { ledgerStart: 900 });
    await expect(client.get('/v2/x/', {}, Schema, OPTS)).rejects.toBeInstanceOf(CreditBudgetError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('record mode', () => {
  it('writes a fixture file for the response', async () => {
    const { dir, client } = await setup('record');
    await client.get('/v2/x/', { a: 1 }, Schema, OPTS);
    expect(await readdir(dir)).toContain(fixtureFileName(cacheKey('/v2/x/', { a: 1 })));
  });
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/sectors/client.test.ts`
Expected: FAIL, "Cannot find module '@/lib/sectors/client'"

- [ ] **Step 3: Buat `lib/sectors/client.ts`**

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ZodType } from 'zod';
import { canSpend, CreditBudgetError } from './budget';
import { cacheKey, canonicalQuery, fixtureFileName, type QueryParams } from './keys';
import type { CacheStore, CreditLedger } from './stores';

export type SectorsMode = 'fixture' | 'record' | 'live';

export class FixtureMissingError extends Error {
  constructor(
    public readonly key: string,
    public readonly file: string,
  ) {
    super(`No Sectors fixture for ${key} (expected ${file}). Record it with \`pnpm record\` or use SECTORS_MODE=fake.`);
    this.name = 'FixtureMissingError';
  }
}

export class SectorsHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    body: string,
  ) {
    super(`Sectors ${path} responded ${status}: ${body.slice(0, 200)}`);
    this.name = 'SectorsHttpError';
  }
}

export interface GetOptions {
  cost: number;
  /** null = never expires (historical data). */
  ttlSeconds: number | null;
}

export interface SectorsClient {
  get<T>(path: string, params: QueryParams, schema: ZodType<T>, opts: GetOptions): Promise<T>;
}

export interface SectorsClientOptions {
  mode: SectorsMode;
  apiKey?: string;
  baseUrl?: string;
  fixturesDir: string;
  cache: CacheStore;
  ledger: CreditLedger;
  budget: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_SERVER_RETRIES = 1;

export function createSectorsClient(o: SectorsClientOptions): SectorsClient {
  const baseUrl = o.baseUrl ?? 'https://api.sectors.app';
  const fetchImpl = o.fetchImpl ?? fetch;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = o.now ?? Date.now;

  async function readFixture(key: string): Promise<unknown> {
    const file = path.join(o.fixturesDir, fixtureFileName(key));
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      throw new FixtureMissingError(key, file);
    }
    return (JSON.parse(text) as { data: unknown }).data;
  }

  async function writeFixture(key: string, data: unknown): Promise<void> {
    await mkdir(o.fixturesDir, { recursive: true });
    await writeFile(path.join(o.fixturesDir, fixtureFileName(key)), JSON.stringify({ key, data }, null, 2));
  }

  async function fetchLive(p: string, params: QueryParams, cost: number): Promise<unknown> {
    const used = await o.ledger.total();
    if (!canSpend(used, cost, o.budget)) throw new CreditBudgetError(used, cost, o.budget);
    if (!o.apiKey) throw new Error('SECTORS_API_KEY is not set');
    const q = canonicalQuery(params);
    const url = `${baseUrl}${p}${q ? `?${q}` : ''}`;
    let rateLimitRetries = 0;
    let serverRetries = 0;
    for (;;) {
      const res = await fetchImpl(url, { headers: { Authorization: o.apiKey } });
      if (res.status === 429 && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
        await sleep(1000 * 2 ** rateLimitRetries);
        rateLimitRetries++;
        continue;
      }
      if (res.status >= 500 && serverRetries < MAX_SERVER_RETRIES) {
        serverRetries++;
        await sleep(1000);
        continue;
      }
      // Sectors bills 2xx and 404; 400/401/403/429/5xx are free.
      if (res.ok || res.status === 404) await o.ledger.record(p, cost);
      if (!res.ok) throw new SectorsHttpError(res.status, p, await res.text());
      return res.json();
    }
  }

  return {
    async get<T>(p: string, params: QueryParams, schema: ZodType<T>, opts: GetOptions): Promise<T> {
      const key = cacheKey(p, params);
      if (o.mode === 'fixture') return schema.parse(await readFixture(key));

      let raw: unknown;
      const cached = await o.cache.get(key, now());
      if (cached !== null) {
        raw = JSON.parse(cached);
      } else {
        raw = await fetchLive(p, params, opts.cost);
        const expiresAt = opts.ttlSeconds === null ? null : now() + opts.ttlSeconds * 1000;
        await o.cache.set(key, JSON.stringify(raw), expiresAt);
      }
      if (o.mode === 'record') await writeFixture(key, raw);
      return schema.parse(raw);
    },
  };
}
```

- [ ] **Step 4: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/sectors/client.test.ts && pnpm typecheck`
Expected: PASS (10 test).

- [ ] **Step 5: Commit**

```bash
git add lib/sectors/client.ts tests/sectors/client.test.ts
git commit -m "feat(sectors): HTTP client with fixture/record/live modes, cache, retries and budget guard"
```

---

### Task 5: Skema endpoint, fungsi endpoint, adapter MarketData, contract test

**Files:**
- Create: `lib/sectors/schemas.ts`, `lib/sectors/endpoints.ts`, `lib/sectors/market-data.ts`, `lib/sectors/from-env.ts`, `fixtures/samples/daily.json`, `fixtures/samples/index-daily.json`, `fixtures/samples/foreign-flow.json`, `fixtures/samples/screener.json`, `fixtures/samples/company-report-overview.json`, `fixtures/samples/top-changes.json`, `fixtures/samples/news.json`, `tests/helpers/fixtures.ts`, `tests/sectors/schemas.test.ts`, `tests/sectors/endpoints.test.ts`

**Interfaces:**
- Consumes: `SectorsClient`, `createSectorsClient`, `SectorsMode` (Task 4), `dbCache`, `dbLedger`, `memoryCache`, `memoryLedger` (Task 3), `normalizeSymbol`, `todayWib`, `MarketData`, `Company`, `PricePoint`, `FlowPoint`, `Mover` (Task 1).
- Produces:
  - Skema zod: `DailySchema`, `IndexDailySchema`, `ForeignFlowSchema`, `ScreenerSchema`, `CompanyOverviewSchema`, `TopChangesSchema`, `NewsArticleSchema`, `NewsPageSchema`, `TagsSchema`, `type NewsArticle`
  - `UNIVERSE_WHERE`, `UNIVERSE_PAGE_SIZE`, `priceTtl(end, today)`, `groupWhere(group)`, `indexWhere(code)`
  - `fetchDaily(c, symbol, start, end, today)`, `fetchIndexDaily(c, code, start, end, today)`, `fetchForeignFlow(c, symbol, start, end, today)`, `fetchUniverse(c)`, `fetchScreenerSymbols(c, where)`, `fetchAffiliates(c, symbol)`, `fetchTopLosers1d(c)`, `fetchNewsPage(c, { start, offset, tags? }): Promise<NewsPage>`, `interface NewsPage { articles: NewsArticle[]; hasNext: boolean; nextOffset: number | null }`
  - `createSectorsMarketData(c, today?): MarketData`
  - `sectorsFromEnv(db: Db): SectorsClient`, `creditBudget(): number`

- [ ] **Step 1: Buat sampel respons dari dokumentasi resmi di `fixtures/samples/`**

`fixtures/samples/daily.json`:
```json
[{ "symbol": "BBCA.JK", "date": "2025-05-02", "close": 8975, "open": 9000, "high": 9000, "low": 8850, "volume": 92219000, "market_cap": 1095329638012500 }]
```

`fixtures/samples/index-daily.json`:
```json
[{ "index_code": "LQ45", "date": "2025-05-05", "price": 767.32 }]
```

`fixtures/samples/foreign-flow.json`:
```json
{ "symbol": "BBCA.JK", "start": "2025-05-01", "end": "2025-05-05", "data": [{ "date": "2025-05-02", "net_foreign_inflow": 146476750000, "foreign_buy_idr": 558094712500, "foreign_sell_idr": 411617962500, "foreign_share": 0.5875 }] }
```

`fixtures/samples/screener.json`:
```json
{ "results": [{ "symbol": "BBCA.JK", "company_name": "PT Bank Central Asia Tbk.", "query_values": { "sub_sector": "Banks", "market_cap": 753611199412500 } }], "pagination": { "total_count": 1, "showing": 1, "limit": 200, "offset": 0, "has_next": false, "has_previous": false, "next_offset": null, "previous_offset": null } }
```

`fixtures/samples/company-report-overview.json`:
```json
{ "symbol": "BBCA.JK", "company_name": "PT Bank Central Asia Tbk.", "overview": { "listing_board": "Main", "sector": "Financials", "sub_sector": "Banks", "market_cap": 753611199412500, "indices": ["IDX30"], "affiliates": ["Djarum", "Hartono"] } }
```

`fixtures/samples/top-changes.json`:
```json
{ "top_losers": { "1d": [{ "name": "Sentul City Tbk", "symbol": "BKSL.JK", "price_change": -0.0895522388059701, "last_close_price": 61, "latest_close_date": "2026-07-08" }] } }
```

`fixtures/samples/news.json`:
```json
{ "results": [{ "title": "OJK says Henry Surya's false statements delayed the investigation into PT Asuransi Jiwa Prolife Indonesia fraud case", "body": "The Financial Services Authority (OJK) said Henry Surya's lies prolonged the probe of a fraud at PT Asuransi Jiwa Prolife Indonesia.", "source": "https://money.kompas.com/read/2026/07/09/180504926/ojk-sebut-kebohongan-henry-surya-buat-pengusutan-kasus-indosurya-makan-waktu", "thumbnail": null, "timestamp": "2026-07-09T18:05:00", "sector": "financials", "sub_sector": ["insurance"], "tags": ["Violation", "Risk & Compliance", "Politics & Regulation", "Bearish"], "symbols": [], "dimension": { "future": 0, "dividend": 0, "ownership": 0, "technical": 0, "valuation": 0, "financials": 0, "management": 0, "sustainability": 0 } }], "pagination": { "total_count": 8665, "showing": 1, "limit": 30, "offset": 0, "has_next": true, "has_previous": false, "next_offset": 30, "previous_offset": null } }
```

- [ ] **Step 2: Buat helper test `tests/helpers/fixtures.ts`**

```ts
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSectorsClient } from '@/lib/sectors/client';
import { cacheKey, fixtureFileName, type QueryParams } from '@/lib/sectors/keys';
import { memoryCache, memoryLedger } from '@/lib/sectors/stores';

export async function tempFixtureClient() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sectors-fx-'));
  const client = createSectorsClient({
    mode: 'fixture',
    fixturesDir: dir,
    cache: memoryCache(),
    ledger: memoryLedger(),
    budget: 1000,
  });
  return { dir, client };
}

export async function putFixture(dir: string, pathName: string, params: QueryParams, data: unknown): Promise<void> {
  const key = cacheKey(pathName, params);
  await writeFile(path.join(dir, fixtureFileName(key)), JSON.stringify({ key, data }));
}

export async function loadSample(name: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(process.cwd(), 'fixtures', 'samples', name), 'utf8'));
}
```

- [ ] **Step 3: Tulis contract test yang gagal di `tests/sectors/schemas.test.ts`**

```ts
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import {
  CompanyOverviewSchema,
  DailySchema,
  ForeignFlowSchema,
  IndexDailySchema,
  NewsPageSchema,
  ScreenerSchema,
  TagsSchema,
  TopChangesSchema,
} from '@/lib/sectors/schemas';
import { loadSample } from '../helpers/fixtures';

const samples: Array<[string, ZodType<unknown>]> = [
  ['daily.json', DailySchema],
  ['index-daily.json', IndexDailySchema],
  ['foreign-flow.json', ForeignFlowSchema],
  ['screener.json', ScreenerSchema],
  ['company-report-overview.json', CompanyOverviewSchema],
  ['top-changes.json', TopChangesSchema],
  ['news.json', NewsPageSchema],
];

function schemaForKey(key: string): ZodType<unknown> | null {
  if (key.startsWith('/v2/daily/')) return DailySchema;
  if (key.startsWith('/v2/index-daily/')) return IndexDailySchema;
  if (key.startsWith('/v2/foreign-flow/')) return ForeignFlowSchema;
  if (key.startsWith('/v2/companies/top-changes/')) return TopChangesSchema;
  if (key.startsWith('/v2/companies/')) return ScreenerSchema;
  if (key.startsWith('/v2/company/report/')) return CompanyOverviewSchema;
  if (key.startsWith('/v2/news/')) return NewsPageSchema;
  if (key.startsWith('/v2/tags/')) return TagsSchema;
  return null;
}

describe('schemas accept documented samples', () => {
  it.each(samples)('%s', async (file, schema) => {
    const result = schema.safeParse(await loadSample(file));
    expect(result.success).toBe(true);
  });
});

describe('schemas accept every recorded fixture', () => {
  it('parses all files in fixtures/sectors (passes trivially before recording)', async () => {
    const dir = path.join(process.cwd(), 'fixtures', 'sectors');
    if (!existsSync(dir)) return;
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      const { key, data } = JSON.parse(await readFile(path.join(dir, f), 'utf8')) as { key: string; data: unknown };
      const schema = schemaForKey(key);
      expect(schema, `no schema mapped for ${key}`).not.toBeNull();
      const result = schema!.safeParse(data);
      expect(result.success, `${f} (${key}): ${result.success ? '' : result.error.message}`).toBe(true);
    }
  });
});
```

- [ ] **Step 4: Tulis test endpoint yang gagal di `tests/sectors/endpoints.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  fetchAffiliates,
  fetchDaily,
  fetchForeignFlow,
  fetchIndexDaily,
  fetchNewsPage,
  fetchTopLosers1d,
  fetchUniverse,
  indexWhere,
  priceTtl,
  UNIVERSE_PAGE_SIZE,
  UNIVERSE_WHERE,
} from '@/lib/sectors/endpoints';
import { createSectorsMarketData } from '@/lib/sectors/market-data';
import { loadSample, putFixture, tempFixtureClient } from '../helpers/fixtures';

const TODAY = '2026-09-22';

describe('priceTtl', () => {
  it('is permanent for windows that ended before today', () => {
    expect(priceTtl('2026-09-21', TODAY)).toBeNull();
    expect(priceTtl('2026-09-22', TODAY)).toBe(3600);
  });
});

describe('endpoints', () => {
  it('fetchDaily maps and sorts ascending', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/daily/BBCA/', { start: '2025-05-01', end: '2025-05-14' }, [
      { symbol: 'BBCA.JK', date: '2025-05-05', close: 9000 },
      { symbol: 'BBCA.JK', date: '2025-05-02', close: 8975 },
    ]);
    expect(await fetchDaily(client, 'bbca.jk', '2025-05-01', '2025-05-14', TODAY)).toEqual([
      { date: '2025-05-02', close: 8975 },
      { date: '2025-05-05', close: 9000 },
    ]);
  });

  it('fetchIndexDaily maps price to close', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/index-daily/ihsg/', { start: '2025-05-01', end: '2025-05-14' }, [
      { index_code: 'IHSG', date: '2025-05-05', price: 6800.5 },
    ]);
    expect(await fetchIndexDaily(client, 'IHSG', '2025-05-01', '2025-05-14', TODAY)).toEqual([
      { date: '2025-05-05', close: 6800.5 },
    ]);
  });

  it('fetchForeignFlow maps net inflow', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/foreign-flow/BBCA/', { start: '2025-05-01', end: '2025-05-05' }, await loadSample('foreign-flow.json'));
    expect(await fetchForeignFlow(client, 'BBCA', '2025-05-01', '2025-05-05', TODAY)).toEqual([
      { date: '2025-05-02', netForeignInflow: 146476750000 },
    ]);
  });

  it('fetchUniverse reads sub_sector and market_cap from query_values', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(
      dir,
      '/v2/companies/',
      { where: UNIVERSE_WHERE, order_by: '-market_cap', limit: UNIVERSE_PAGE_SIZE, offset: 0, include_query_values: true },
      await loadSample('screener.json'),
    );
    expect(await fetchUniverse(client)).toEqual([
      { symbol: 'BBCA', name: 'PT Bank Central Asia Tbk.', subSector: 'Banks', marketCap: 753611199412500 },
    ]);
  });

  it('fetchAffiliates returns overview affiliates', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/company/report/BBCA/', { sections: 'overview' }, await loadSample('company-report-overview.json'));
    expect(await fetchAffiliates(client, 'BBCA')).toEqual(['Djarum', 'Hartono']);
  });

  it('fetchTopLosers1d normalizes symbols', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/companies/top-changes/', { classifications: 'top_losers', periods: '1d', n_stock: 10 }, await loadSample('top-changes.json'));
    expect(await fetchTopLosers1d(client)).toEqual([
      { symbol: 'BKSL', name: 'Sentul City Tbk', priceChange: -0.0895522388059701, date: '2026-07-08' },
    ]);
  });

  it('fetchNewsPage returns articles and pagination', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/news/', { start: '2026-07-01', limit: 30, offset: 0 }, await loadSample('news.json'));
    const page = await fetchNewsPage(client, { start: '2026-07-01', offset: 0 });
    expect(page.articles).toHaveLength(1);
    expect(page.hasNext).toBe(true);
    expect(page.nextOffset).toBe(30);
  });

  it('MarketData.indexMembers queries the screener by index', async () => {
    const { dir, client } = await tempFixtureClient();
    await putFixture(dir, '/v2/companies/', { where: indexWhere('IDXBUMN20'), order_by: '-market_cap', limit: 50 }, await loadSample('screener.json'));
    const market = createSectorsMarketData(client, () => TODAY);
    expect(await market.indexMembers('idxbumn20')).toEqual(['BBCA']);
  });
});
```

- [ ] **Step 5: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/sectors/schemas.test.ts tests/sectors/endpoints.test.ts`
Expected: FAIL, modul `@/lib/sectors/schemas` tidak ditemukan.

- [ ] **Step 6: Buat `lib/sectors/schemas.ts`**

```ts
import { z } from 'zod';

export const DailySchema = z.array(
  z.object({ symbol: z.string(), date: z.string(), close: z.number() }).passthrough(),
);

export const IndexDailySchema = z.array(
  z.object({ index_code: z.string(), date: z.string(), price: z.number() }).passthrough(),
);

export const ForeignFlowSchema = z
  .object({
    symbol: z.string(),
    data: z.array(z.object({ date: z.string(), net_foreign_inflow: z.number() }).passthrough()),
  })
  .passthrough();

const PaginationSchema = z
  .object({ total_count: z.number(), has_next: z.boolean(), next_offset: z.number().nullable() })
  .passthrough();

export const ScreenerSchema = z
  .object({
    results: z.array(
      z
        .object({
          symbol: z.string(),
          company_name: z.string(),
          query_values: z.record(z.unknown()).nullable().optional(),
        })
        .passthrough(),
    ),
    pagination: PaginationSchema,
  })
  .passthrough();

export const CompanyOverviewSchema = z
  .object({
    symbol: z.string(),
    company_name: z.string(),
    overview: z
      .object({
        sub_sector: z.string().nullable().optional(),
        affiliates: z.array(z.string()).nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const MoverSchema = z
  .object({ name: z.string(), symbol: z.string(), price_change: z.number(), latest_close_date: z.string() })
  .passthrough();

export const TopChangesSchema = z
  .object({
    top_losers: z.record(z.array(MoverSchema)).optional(),
    top_gainers: z.record(z.array(MoverSchema)).optional(),
  })
  .passthrough();

export const NewsArticleSchema = z
  .object({
    title: z.string(),
    body: z.string().nullable().optional(),
    source: z.string(),
    timestamp: z.string(),
    sector: z.string().nullable().optional(),
    sub_sector: z.array(z.string()).nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    symbols: z.array(z.string()).nullable().optional(),
  })
  .passthrough();

export type NewsArticle = z.infer<typeof NewsArticleSchema>;

export const NewsPageSchema = z.object({ results: z.array(NewsArticleSchema), pagination: PaginationSchema }).passthrough();

export const TagsSchema = z.array(z.string());
```

- [ ] **Step 7: Buat `lib/sectors/endpoints.ts`**

```ts
import { normalizeSymbol, type Company, type FlowPoint, type Mover, type PricePoint } from '@/lib/domain';
import type { SectorsClient } from './client';
import {
  CompanyOverviewSchema,
  DailySchema,
  ForeignFlowSchema,
  IndexDailySchema,
  NewsPageSchema,
  ScreenerSchema,
  TopChangesSchema,
  type NewsArticle,
} from './schemas';

const DAY_SECONDS = 86_400;
const WEEK_SECONDS = 7 * DAY_SECONDS;
const UNIVERSE_MAX_PAGES = 10;

export const UNIVERSE_WHERE = "market_cap > 0 and sub_sector != ''";
export const UNIVERSE_PAGE_SIZE = 200;

/** Price windows that ended before today never change, so cache them forever. */
export function priceTtl(end: string, today: string): number | null {
  return end < today ? null : 3600;
}

const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);
const quote = (v: string) => `'${v.replace(/'/g, '')}'`;

export const groupWhere = (group: string) => `affiliates in [${quote(group)}]`;
export const indexWhere = (code: string) => `indices in [${quote(code.toUpperCase())}]`;

export async function fetchDaily(c: SectorsClient, symbol: string, start: string, end: string, today: string): Promise<PricePoint[]> {
  const rows = await c.get(`/v2/daily/${normalizeSymbol(symbol)}/`, { start, end }, DailySchema, {
    cost: 1,
    ttlSeconds: priceTtl(end, today),
  });
  return rows.map((r) => ({ date: r.date, close: r.close })).sort(byDate);
}

export async function fetchIndexDaily(c: SectorsClient, code: string, start: string, end: string, today: string): Promise<PricePoint[]> {
  const rows = await c.get(`/v2/index-daily/${code.toLowerCase()}/`, { start, end }, IndexDailySchema, {
    cost: 1,
    ttlSeconds: priceTtl(end, today),
  });
  return rows.map((r) => ({ date: r.date, close: r.price })).sort(byDate);
}

export async function fetchForeignFlow(c: SectorsClient, symbol: string, start: string, end: string, today: string): Promise<FlowPoint[]> {
  const res = await c.get(`/v2/foreign-flow/${normalizeSymbol(symbol)}/`, { start, end }, ForeignFlowSchema, {
    cost: 1,
    ttlSeconds: priceTtl(end, today),
  });
  return res.data.map((d) => ({ date: d.date, netForeignInflow: d.net_foreign_inflow })).sort(byDate);
}

export async function fetchUniverse(c: SectorsClient): Promise<Company[]> {
  const out: Company[] = [];
  let offset = 0;
  for (let page = 0; page < UNIVERSE_MAX_PAGES; page++) {
    const res = await c.get(
      '/v2/companies/',
      { where: UNIVERSE_WHERE, order_by: '-market_cap', limit: UNIVERSE_PAGE_SIZE, offset, include_query_values: true },
      ScreenerSchema,
      { cost: 1, ttlSeconds: WEEK_SECONDS },
    );
    for (const r of res.results) {
      const qv = r.query_values ?? {};
      out.push({
        symbol: normalizeSymbol(r.symbol),
        name: r.company_name,
        subSector: typeof qv.sub_sector === 'string' ? qv.sub_sector : null,
        marketCap: typeof qv.market_cap === 'number' ? qv.market_cap : null,
      });
    }
    if (!res.pagination.has_next || res.pagination.next_offset === null) break;
    offset = res.pagination.next_offset;
  }
  return out;
}

export async function fetchScreenerSymbols(c: SectorsClient, where: string): Promise<string[]> {
  const res = await c.get('/v2/companies/', { where, order_by: '-market_cap', limit: 50 }, ScreenerSchema, {
    cost: 1,
    ttlSeconds: WEEK_SECONDS,
  });
  return res.results.map((r) => normalizeSymbol(r.symbol));
}

export async function fetchAffiliates(c: SectorsClient, symbol: string): Promise<string[]> {
  const res = await c.get(`/v2/company/report/${normalizeSymbol(symbol)}/`, { sections: 'overview' }, CompanyOverviewSchema, {
    cost: 1,
    ttlSeconds: WEEK_SECONDS,
  });
  return res.overview.affiliates ?? [];
}

export async function fetchTopLosers1d(c: SectorsClient): Promise<Mover[]> {
  const res = await c.get(
    '/v2/companies/top-changes/',
    { classifications: 'top_losers', periods: '1d', n_stock: 10 },
    TopChangesSchema,
    { cost: 1, ttlSeconds: 3600 },
  );
  return (res.top_losers?.['1d'] ?? []).map((m) => ({
    symbol: normalizeSymbol(m.symbol),
    name: m.name,
    priceChange: m.price_change,
    date: m.latest_close_date,
  }));
}

export interface NewsPage {
  articles: NewsArticle[];
  hasNext: boolean;
  nextOffset: number | null;
}

export async function fetchNewsPage(c: SectorsClient, q: { start: string; offset: number; tags?: string }): Promise<NewsPage> {
  const res = await c.get('/v2/news/', { start: q.start, limit: 30, offset: q.offset, tags: q.tags }, NewsPageSchema, {
    cost: 1,
    ttlSeconds: 1800,
  });
  return { articles: res.results, hasNext: res.pagination.has_next, nextOffset: res.pagination.next_offset };
}
```

- [ ] **Step 8: Buat `lib/sectors/market-data.ts`**

```ts
import { todayWib, type MarketData } from '@/lib/domain';
import type { SectorsClient } from './client';
import {
  fetchAffiliates,
  fetchDaily,
  fetchForeignFlow,
  fetchIndexDaily,
  fetchScreenerSymbols,
  fetchTopLosers1d,
  fetchUniverse,
  groupWhere,
  indexWhere,
} from './endpoints';

export function createSectorsMarketData(c: SectorsClient, today: () => string = () => todayWib()): MarketData {
  return {
    today,
    universe: () => fetchUniverse(c),
    daily: (symbol, start, end) => fetchDaily(c, symbol, start, end, today()),
    ihsg: (start, end) => fetchIndexDaily(c, 'ihsg', start, end, today()),
    foreignFlow: (symbol, start, end) => fetchForeignFlow(c, symbol, start, end, today()),
    affiliates: (symbol) => fetchAffiliates(c, symbol),
    groupMembers: (group) => fetchScreenerSymbols(c, groupWhere(group)),
    indexMembers: (code) => fetchScreenerSymbols(c, indexWhere(code)),
    topLosers1d: () => fetchTopLosers1d(c),
  };
}
```

- [ ] **Step 9: Buat `lib/sectors/from-env.ts`**

```ts
import path from 'node:path';
import type { Db } from '@/lib/db/client';
import { createSectorsClient, type SectorsClient, type SectorsMode } from './client';
import { dbCache, dbLedger } from './stores';

const MODES: SectorsMode[] = ['fixture', 'record', 'live'];

export function creditBudget(): number {
  return Number(process.env.SECTORS_CREDIT_BUDGET ?? 1000);
}

export function sectorsFromEnv(db: Db): SectorsClient {
  const mode = (process.env.SECTORS_MODE ?? 'fixture') as SectorsMode;
  if (!MODES.includes(mode)) {
    throw new Error(`SECTORS_MODE must be one of ${MODES.join(', ')} for the real client (got ${mode})`);
  }
  return createSectorsClient({
    mode,
    apiKey: process.env.SECTORS_API_KEY,
    fixturesDir: path.join(process.cwd(), 'fixtures', 'sectors'),
    cache: dbCache(db),
    ledger: dbLedger(db),
    budget: creditBudget(),
  });
}
```

- [ ] **Step 10: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/sectors && pnpm typecheck`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add lib/sectors fixtures/samples tests/sectors tests/helpers/fixtures.ts
git commit -m "feat(sectors): endpoint schemas, typed endpoint functions and MarketData adapter"
```

---

### Task 6: Tanggal event, jendela harga, dan hari bursa

**Files:**
- Create: `lib/market/dates.ts`, `tests/market/dates.test.ts`

**Interfaces:**
- Produces:
  - `addDays(date: string, n: number): string`
  - `eventCalendarDate(publishedAt: string): string`: hari (WIB) pertama yang sesi bursanya bisa terdampak event. Event pukul ≥ 16:00 WIB dihitung ke hari berikutnya
  - `priceWindow(eventDay: string, today: string): { start: string; end: string }`: `end` = tanggal 15 atau akhir bulan setelah `eventDay + 10`, dibatasi `today`. `start = end − 89`
  - `firstTradingDayOnOrAfter(tradingDays: string[], day: string): string | null` (`tradingDays` urut naik)

- [ ] **Step 1: Tulis test yang gagal di `tests/market/dates.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { addDays, eventCalendarDate, firstTradingDayOnOrAfter, priceWindow } from '@/lib/market/dates';

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('eventCalendarDate', () => {
  it('treats timestamps without offset as WIB', () => {
    expect(eventCalendarDate('2026-07-09T10:00:00')).toBe('2026-07-09');
    expect(eventCalendarDate('2026-07-09T18:05:00')).toBe('2026-07-10');
  });
  it('converts timestamps with an offset to WIB', () => {
    expect(eventCalendarDate('2026-07-09T02:00:00Z')).toBe('2026-07-09');
    expect(eventCalendarDate('2026-07-09T10:00:00Z')).toBe('2026-07-10');
    expect(eventCalendarDate('2026-07-09T15:30:00+07:00')).toBe('2026-07-09');
  });
  it('keeps plain dates', () => {
    expect(eventCalendarDate('2026-07-09')).toBe('2026-07-09');
  });
});

describe('priceWindow', () => {
  it('ends on the 15th when eventDay+10 falls in the first half', () => {
    expect(priceWindow('2026-03-02', '2026-09-22')).toEqual({ start: '2025-12-16', end: '2026-03-15' });
  });
  it('ends on the last day of the month otherwise', () => {
    expect(priceWindow('2026-03-10', '2026-09-22')).toEqual({ start: '2026-01-01', end: '2026-03-31' });
  });
  it('shares one window for nearby events (cache reuse)', () => {
    expect(priceWindow('2026-03-01', '2026-09-22')).toEqual(priceWindow('2026-03-05', '2026-09-22'));
  });
  it('is capped at today', () => {
    expect(priceWindow('2026-09-20', '2026-09-22')).toEqual({ start: '2026-06-25', end: '2026-09-22' });
  });
});

describe('firstTradingDayOnOrAfter', () => {
  it('skips weekends and holidays using real trading days', () => {
    expect(firstTradingDayOnOrAfter(['2026-03-13', '2026-03-16'], '2026-03-14')).toBe('2026-03-16');
    expect(firstTradingDayOnOrAfter(['2026-03-13'], '2026-03-13')).toBe('2026-03-13');
    expect(firstTradingDayOnOrAfter(['2026-03-13'], '2026-03-14')).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/market/dates.test.ts`
Expected: FAIL, "Cannot find module '@/lib/market/dates'"

- [ ] **Step 3: Buat `lib/market/dates.ts`**

```ts
const WIB_OFFSET_MS = 7 * 3_600_000;
export const MARKET_CLOSE_HOUR_WIB = 16;
const WINDOW_DAYS = 89;
const POST_EVENT_CALENDAR_DAYS = 10;

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** First WIB calendar day whose trading session can react to the event. */
export function eventCalendarDate(publishedAt: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) return publishedAt;
  const hasOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(publishedAt);
  const wib = hasOffset
    ? new Date(new Date(publishedAt).getTime() + WIB_OFFSET_MS)
    : new Date(`${publishedAt.replace(' ', 'T')}Z`);
  const day = wib.toISOString().slice(0, 10);
  return wib.getUTCHours() >= MARKET_CLOSE_HOUR_WIB ? addDays(day, 1) : day;
}

function lastDayOfMonth(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * 90-day fetch window around an event. The end is bucketed to the 15th or the
 * month end so nearby events share cached price data.
 */
export function priceWindow(eventDay: string, today: string): { start: string; end: string } {
  const target = addDays(eventDay, POST_EVENT_CALENDAR_DAYS);
  const bucketEnd = Number(target.slice(8, 10)) <= 15 ? `${target.slice(0, 8)}15` : lastDayOfMonth(target);
  const end = bucketEnd < today ? bucketEnd : today;
  return { start: addDays(end, -WINDOW_DAYS), end };
}

export function firstTradingDayOnOrAfter(tradingDays: string[], day: string): string | null {
  return tradingDays.find((d) => d >= day) ?? null;
}
```

- [ ] **Step 4: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/market/dates.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/market/dates.ts tests/market/dates.test.ts
git commit -m "feat(market): event day resolution, bucketed price windows, trading-day lookup"
```

---

### Task 7: Reaksi pasar (abnormal return, signifikansi) dan ringkasan subsektor

**Files:**
- Create: `lib/market/reaction.ts`, `lib/market/peers.ts`, `tests/helpers/series.ts`, `tests/market/reaction.test.ts`, `tests/market/peers.test.ts`

**Interfaces:**
- Consumes: `PricePoint`, `FlowPoint`, `Reaction`, `StockFinding`, `SubSectorSummary` (Task 1).
- Produces:
  - Konstanta: `ESTIMATION_MAX = 40`, `ESTIMATION_MIN = 20`, `POST_DAYS = 5`, `Z_THRESHOLD = 2`, `MARKET_WIDE_THRESHOLD = 0.02`
  - `dailyReturns(points): { date: string; ret: number }[]`, `stdev(xs: number[]): number` (sampel, n−1)
  - `measureReaction(stock: PricePoint[], market: PricePoint[], eventDay: string): Reaction | null`
  - `marketReturnOn(market: PricePoint[], day: string): number | null`, `isMarketWide(ihsgReturnT0: number): boolean`
  - `sumFlowBetween(flow: FlowPoint[], from: string, to: string): number`
  - `summarizeSubSectors(findings: StockFinding[]): SubSectorSummary[]` (urut dari rata-rata CAR terendah)
  - Test helper: `weekdays(start, n)`, `pricesFromReturns(dates, rets)`

Definisi: return ke-t = close_t / close_{t−1} − 1. AR = r_saham − r_IHSG, dicocokkan per tanggal. t0 = hari bursa pertama ≥ `eventDay`. σ = stdev AR pada maksimal 40 hari sebelum t0−1, minimal 20 hari (kalau kurang, hasilnya `null`). Jendela event = t0 sampai t0+5. CAR = Σ AR. z = CAR/(σ·√n). Signifikan kalau |z| ≥ 2.

- [ ] **Step 1: Buat helper `tests/helpers/series.ts`**

```ts
import type { PricePoint } from '@/lib/domain';

/** n consecutive Mon–Fri dates starting at `start` (inclusive if it is a weekday). */
export function weekdays(start: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  while (out.length < n) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Price series whose i-th return (i ≥ 1) equals rets[i]. rets[0] is ignored. */
export function pricesFromReturns(dates: string[], rets: number[]): PricePoint[] {
  let p = 1000;
  return dates.map((date, i) => {
    if (i > 0) p = p * (1 + rets[i]);
    return { date, close: p };
  });
}
```

- [ ] **Step 2: Tulis test yang gagal di `tests/market/reaction.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  dailyReturns,
  isMarketWide,
  marketReturnOn,
  measureReaction,
  stdev,
  sumFlowBetween,
} from '@/lib/market/reaction';
import { pricesFromReturns, weekdays } from '../helpers/series';

// 2026-01-05 is a Monday; index 45 is Monday 2026-03-09.
const DATES = weekdays('2026-01-05', 60);
const marketRets = DATES.map((_, i) => 0.002 * (i % 2 === 0 ? 1 : -1));
const noise = (i: number) => 0.004 * (i % 3 === 0 ? 1 : -0.5);
const market = pricesFromReturns(DATES, marketRets);

function stockWithShock(shock: number) {
  return pricesFromReturns(
    DATES,
    DATES.map((_, i) => marketRets[i] + noise(i) + (i === 45 ? shock : 0)),
  );
}

describe('helpers', () => {
  it('computes simple returns and sample stdev', () => {
    expect(dailyReturns([{ date: 'a', close: 100 }, { date: 'b', close: 110 }])).toEqual([{ date: 'b', ret: 0.10000000000000009 }]);
    expect(stdev([1, 2, 3, 4])).toBeCloseTo(1.2909944, 6);
  });
});

describe('measureReaction', () => {
  it('detects a significant abnormal drop at t0', () => {
    expect(DATES[45]).toBe('2026-03-09');
    const r = measureReaction(stockWithShock(-0.08), market, '2026-03-09');
    expect(r).not.toBeNull();
    expect(r!.t0).toBe('2026-03-09');
    expect(r!.days).toBe(6);
    expect(r!.tEnd).toBe(DATES[50]);
    expect(r!.car).toBeLessThan(-0.07);
    expect(r!.significant).toBe(true);
    expect(r!.zScore).toBeLessThan(-2);
  });

  it('reports no significant reaction without a shock', () => {
    const r = measureReaction(stockWithShock(0), market, '2026-03-09');
    expect(r!.significant).toBe(false);
    expect(Math.abs(r!.car)).toBeLessThan(0.01);
  });

  it('maps a weekend event to the next trading day', () => {
    expect(measureReaction(stockWithShock(-0.08), market, '2026-03-07')!.t0).toBe('2026-03-09');
  });

  it('returns null when the estimation window is too short', () => {
    expect(measureReaction(stockWithShock(0), market, DATES[10])).toBeNull();
  });

  it('returns null when the event is after the last trading day', () => {
    expect(measureReaction(stockWithShock(0), market, '2026-12-31')).toBeNull();
  });
});

describe('market helpers', () => {
  it('reads the IHSG return of a day and flags market-wide moves', () => {
    expect(marketReturnOn(market, DATES[1])).toBeCloseTo(-0.002, 10);
    expect(marketReturnOn(market, '1999-01-01')).toBeNull();
    expect(isMarketWide(-0.025)).toBe(true);
    expect(isMarketWide(0.01)).toBe(false);
  });

  it('sums foreign flow inside a date range', () => {
    const flow = [
      { date: '2026-03-06', netForeignInflow: 100 },
      { date: '2026-03-09', netForeignInflow: -300 },
      { date: '2026-03-10', netForeignInflow: 50 },
    ];
    expect(sumFlowBetween(flow, '2026-03-09', '2026-03-10')).toBe(-250);
  });
});
```

- [ ] **Step 3: Tulis test yang gagal di `tests/market/peers.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { summarizeSubSectors } from '@/lib/market/peers';
import { makeCandidate, makeReaction } from '../helpers/factories';

describe('summarizeSubSectors', () => {
  it('averages CAR per sub-sector and skips findings without data', () => {
    const findings = [
      { candidate: makeCandidate({ symbol: 'BBRI', subSector: 'Banks' }), reaction: makeReaction({ car: -0.08 }), netForeignInflow: null, confidence: 'tinggi' as const, explanation: '', dataNote: null },
      { candidate: makeCandidate({ symbol: 'BMRI', subSector: 'Banks' }), reaction: makeReaction({ car: -0.04 }), netForeignInflow: null, confidence: 'sedang' as const, explanation: '', dataNote: null },
      { candidate: makeCandidate({ symbol: 'PTBA', subSector: 'Coal' }), reaction: makeReaction({ car: 0.01 }), netForeignInflow: null, confidence: 'rendah' as const, explanation: '', dataNote: null },
      { candidate: makeCandidate({ symbol: 'TLKM', subSector: 'Telco' }), reaction: null, netForeignInflow: null, confidence: 'rendah' as const, explanation: '', dataNote: 'x' },
    ];
    const out = summarizeSubSectors(findings);
    expect(out.map((s) => s.subSector)).toEqual(['Banks', 'Coal']);
    expect(out[0].avgCar).toBeCloseTo(-0.06, 10);
    expect(out[0].count).toBe(2);
  });
});
```

- [ ] **Step 4: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/market`
Expected: FAIL, modul `@/lib/market/reaction` tidak ditemukan.

- [ ] **Step 5: Buat `lib/market/reaction.ts`**

```ts
import type { FlowPoint, PricePoint, Reaction } from '@/lib/domain';

export const ESTIMATION_MAX = 40;
export const ESTIMATION_MIN = 20;
export const POST_DAYS = 5;
export const Z_THRESHOLD = 2;
export const MARKET_WIDE_THRESHOLD = 0.02;

export interface DailyReturn {
  date: string;
  ret: number;
}

export function dailyReturns(points: PricePoint[]): DailyReturn[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const out: DailyReturn[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].close;
    if (prev > 0) out.push({ date: sorted[i].date, ret: sorted[i].close / prev - 1 });
  }
  return out;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

export function measureReaction(stock: PricePoint[], market: PricePoint[], eventDay: string): Reaction | null {
  const marketByDate = new Map(dailyReturns(market).map((r) => [r.date, r.ret]));
  const aligned = dailyReturns(stock).flatMap((r) => {
    const rm = marketByDate.get(r.date);
    return rm === undefined ? [] : [{ date: r.date, ar: r.ret - rm, rm }];
  });
  const t0Idx = aligned.findIndex((r) => r.date >= eventDay);
  if (t0Idx < 0) return null;

  const estimation = aligned.slice(Math.max(0, t0Idx - 1 - ESTIMATION_MAX), Math.max(0, t0Idx - 1));
  if (estimation.length < ESTIMATION_MIN) return null;

  const window = aligned.slice(t0Idx, t0Idx + POST_DAYS + 1);
  const sigma = stdev(estimation.map((r) => r.ar));
  const car = window.reduce((s, r) => s + r.ar, 0);
  const marketReturn = window.reduce((p, r) => p * (1 + r.rm), 1) - 1;
  const zScore = sigma > 0 ? car / (sigma * Math.sqrt(window.length)) : 0;
  return {
    t0: window[0].date,
    tEnd: window[window.length - 1].date,
    days: window.length,
    car,
    marketReturn,
    sigma,
    zScore,
    significant: Math.abs(zScore) >= Z_THRESHOLD,
  };
}

export function marketReturnOn(market: PricePoint[], day: string): number | null {
  return dailyReturns(market).find((r) => r.date === day)?.ret ?? null;
}

export function isMarketWide(ihsgReturnT0: number): boolean {
  return Math.abs(ihsgReturnT0) >= MARKET_WIDE_THRESHOLD;
}

export function sumFlowBetween(flow: FlowPoint[], from: string, to: string): number {
  return flow.filter((f) => f.date >= from && f.date <= to).reduce((s, f) => s + f.netForeignInflow, 0);
}
```

- [ ] **Step 6: Buat `lib/market/peers.ts`**

```ts
import type { StockFinding, SubSectorSummary } from '@/lib/domain';

export function summarizeSubSectors(findings: StockFinding[]): SubSectorSummary[] {
  const cars = new Map<string, number[]>();
  for (const f of findings) {
    if (!f.reaction || !f.candidate.subSector) continue;
    const list = cars.get(f.candidate.subSector) ?? [];
    list.push(f.reaction.car);
    cars.set(f.candidate.subSector, list);
  }
  return [...cars.entries()]
    .map(([subSector, list]) => ({
      subSector,
      count: list.length,
      avgCar: list.reduce((s, x) => s + x, 0) / list.length,
    }))
    .sort((a, b) => a.avgCar - b.avgCar);
}
```

- [ ] **Step 7: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/market && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/market tests/market tests/helpers/series.ts
git commit -m "feat(market): abnormal-return event study, significance, sub-sector summary"
```

---

### Task 8: Rekam fixture asli dari Sectors (butuh API key, satu orang saja)

**Files:**
- Create: `scripts/env.ts`, `scripts/record-fixtures.ts`, `fixtures/sectors/*.json` (hasil rekaman)

**Interfaces:**
- Consumes: `createDb`, `migrate` (T2), `createSectorsClient` (T4), `createSectorsMarketData`, `fetchNewsPage`, `TagsSchema`, `creditBudget` (T5), `dbCache`, `dbLedger` (T3), `addDays`, `eventCalendarDate`, `priceWindow` (T6), `todayWib` (T1).
- Produces: file fixture asli di `fixtures/sectors/` yang dipakai contract test dan dev mode `fixture`. Juga mencetak **daftar tag berita** yang dibutuhkan Task 21.

Biaya: sekitar 15–20 kredit. **Jalankan sekali saja**, lalu commit hasilnya. Anggota tim lain tidak perlu menjalankan script ini.

- [ ] **Step 1: Buat `scripts/env.ts`** (dipakai semua script. Next.js sudah membaca `.env.local` sendiri, tetapi `tsx` tidak)

```ts
import { existsSync } from 'node:fs';

// Loads .env.local for tsx scripts. Variables already set in the shell take precedence.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
```

- [ ] **Step 1b: Buat `scripts/record-fixtures.ts`**

```ts
import './env';
import path from 'node:path';
import { createDb } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import { todayWib } from '@/lib/domain';
import { addDays, eventCalendarDate, priceWindow } from '@/lib/market/dates';
import { createSectorsClient } from '@/lib/sectors/client';
import { fetchNewsPage } from '@/lib/sectors/endpoints';
import { creditBudget } from '@/lib/sectors/from-env';
import { createSectorsMarketData } from '@/lib/sectors/market-data';
import { TagsSchema } from '@/lib/sectors/schemas';
import { dbCache, dbLedger } from '@/lib/sectors/stores';

// Default: IDX trading-halt day (18 Mar 2025). Override: pnpm record 2026-08-12
const EVENT_DATE = process.argv[2] ?? '2025-03-18';
const SYMBOLS = ['BBRI', 'BMRI', 'TLKM'];

async function main(): Promise<void> {
  if (!process.env.SECTORS_API_KEY) throw new Error('Isi SECTORS_API_KEY di .env.local dulu');
  const db = createDb();
  await migrate(db);
  const ledger = dbLedger(db);
  const client = createSectorsClient({
    mode: 'record',
    apiKey: process.env.SECTORS_API_KEY,
    fixturesDir: path.join(process.cwd(), 'fixtures', 'sectors'),
    cache: dbCache(db),
    ledger,
    budget: creditBudget(),
  });
  const market = createSectorsMarketData(client);
  const before = await ledger.total();
  const today = todayWib();
  const eventDay = eventCalendarDate(EVENT_DATE);
  const win = priceWindow(eventDay, today);
  console.log(`Merekam fixture untuk event ${eventDay}, jendela ${win.start} s/d ${win.end}`);

  const universe = await market.universe();
  console.log(`Universe: ${universe.length} emiten`);
  await market.ihsg(win.start, win.end);
  for (const s of SYMBOLS) {
    await market.daily(s, win.start, win.end);
    await market.foreignFlow(s, win.start, win.end);
  }
  const affiliates = await market.affiliates('BBRI');
  console.log(`Afiliasi BBRI: ${affiliates.join(', ') || '(kosong)'}`);
  if (affiliates[0]) console.log(`Anggota grup ${affiliates[0]}: ${(await market.groupMembers(affiliates[0])).join(', ')}`);
  console.log(`Anggota IDXBUMN20: ${(await market.indexMembers('IDXBUMN20')).join(', ')}`);
  await market.topLosers1d();
  await fetchNewsPage(client, { start: addDays(today, -2), offset: 0 });
  const tags = await client.get('/v2/tags/', {}, TagsSchema, { cost: 1, ttlSeconds: 7 * 86_400 });
  console.log(`Tag berita (${tags.length}): ${tags.join(', ')}`);

  const missing = universe.filter((c) => c.subSector === null).length;
  if (universe.length === 0 || missing > universe.length / 2) {
    console.warn(
      'PERINGATAN: query_values screener tidak memuat sub_sector. Buka fixture v2_companies_*.json, ' +
        'lihat field yang tersedia, lalu sesuaikan UNIVERSE_WHERE/fetchUniverse (spec §4).',
    );
  }
  console.log(`Selesai. Kredit terpakai: ${(await ledger.total()) - before}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Siapkan `.env.local`** (tidak di-commit) dengan `SECTORS_API_KEY=...`, `DATABASE_URL=file:local.db`, `SECTORS_CREDIT_BUDGET=1000`

- [ ] **Step 3: Jalankan perekaman**

Run: `pnpm record`
Expected: log universe (±900+ emiten), afiliasi BBRI, anggota IDXBUMN20, daftar tag, dan "Kredit terpakai" sekitar 15–20. Folder `fixtures/sectors/` berisi sekitar 15 file JSON. **Catat daftar tag** (terutama slug untuk "Politics & Regulation") di README pada Task 22.

- [ ] **Step 4: Verifikasi contract test terhadap fixture asli**

Run: `pnpm test tests/sectors/schemas.test.ts`
Expected: PASS. Kalau ada fixture yang gagal diparse, perbaiki skema di `lib/sectors/schemas.ts` supaya sesuai bentuk asli (pakai `.nullable().optional()`, jangan dihapus), jalankan ulang, lalu commit perbaikannya bersama fixture.

- [ ] **Step 5: Commit**

```bash
git add scripts/env.ts scripts/record-fixtures.ts fixtures/sectors
git commit -m "chore(fixtures): record real Sectors responses for contract tests and dev"
```

---

### Task 9: Klien LLM (OpenAI structured outputs + versi palsu)

**Files:**
- Create: `lib/agent/llm.ts`, `tests/agent/llm.test.ts`

**Interfaces:**
- Consumes: `LlmClient` (Task 1).
- Produces:
  - `class LlmOutputError`
  - `type ChatParser = Pick<OpenAI, 'chat'>`
  - `createOpenAiLlm(opts: { apiKey: string; model: string; client?: ChatParser }): LlmClient`
  - `type FakeResponse = unknown | ((user: string, callIndex: number) => unknown)`
  - `createFakeLlm(responses: Record<string, FakeResponse>): LlmClient & { calls: Array<{ name: string; user: string }> }`. Respons divalidasi dengan skema yang diminta. Kalau fungsi respons melempar error, itu mensimulasikan kegagalan LLM.

Catatan skema untuk OpenAI structured outputs: **semua field wajib**. Pakai `.nullable()` dan jangan pakai `.optional()`.

- [ ] **Step 1: Tulis test yang gagal di `tests/agent/llm.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createFakeLlm, createOpenAiLlm, LlmOutputError, type ChatParser } from '@/lib/agent/llm';

const Answer = z.object({ answer: z.string() });

interface ParseArgs {
  model: string;
  messages: Array<{ role: string; content: string }>;
  response_format: { type: string; json_schema: { name: string } };
}

function fakeOpenAi(parsed: unknown) {
  const parse = vi.fn(async (_args: ParseArgs) => ({ choices: [{ message: { parsed } }] }));
  const client = { chat: { completions: { parse } } } as unknown as ChatParser;
  return { parse, client };
}

describe('createOpenAiLlm', () => {
  it('sends model, messages and a named json_schema response format', async () => {
    const { parse, client } = fakeOpenAi({ answer: 'ok' });
    const llm = createOpenAiLlm({ apiKey: 'k', model: 'test-model', client });
    expect(await llm.parse({ schema: Answer, name: 'demo', system: 'S', user: 'U' })).toEqual({ answer: 'ok' });
    const args = parse.mock.calls[0][0];
    expect(args.model).toBe('test-model');
    expect(args.messages).toEqual([
      { role: 'system', content: 'S' },
      { role: 'user', content: 'U' },
    ]);
    expect(args.response_format.type).toBe('json_schema');
    expect(args.response_format.json_schema.name).toBe('demo');
  });

  it('throws LlmOutputError when nothing was parsed', async () => {
    const { client } = fakeOpenAi(null);
    const llm = createOpenAiLlm({ apiKey: 'k', model: 'm', client });
    await expect(llm.parse({ schema: Answer, name: 'demo', system: 'S', user: 'U' })).rejects.toBeInstanceOf(LlmOutputError);
  });
});

describe('createFakeLlm', () => {
  it('returns canned responses validated by the schema and records calls', async () => {
    const llm = createFakeLlm({ demo: { answer: 'hi' } });
    expect(await llm.parse({ schema: Answer, name: 'demo', system: 'S', user: 'U1' })).toEqual({ answer: 'hi' });
    expect(llm.calls).toEqual([{ name: 'demo', user: 'U1' }]);
  });

  it('supports function responses with a per-name call index', async () => {
    const llm = createFakeLlm({
      demo: (_user: string, i: number) => {
        if (i === 0) throw new Error('first call fails');
        return { answer: `call ${i}` };
      },
    });
    await expect(llm.parse({ schema: Answer, name: 'demo', system: 'S', user: 'U' })).rejects.toThrow('first call fails');
    expect(await llm.parse({ schema: Answer, name: 'demo', system: 'S', user: 'U' })).toEqual({ answer: 'call 1' });
  });

  it('rejects unknown names and schema-invalid responses', async () => {
    const llm = createFakeLlm({ demo: { wrong: true } });
    await expect(llm.parse({ schema: Answer, name: 'other', system: 'S', user: 'U' })).rejects.toBeInstanceOf(LlmOutputError);
    await expect(llm.parse({ schema: Answer, name: 'demo', system: 'S', user: 'U' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/agent/llm.test.ts`
Expected: FAIL, "Cannot find module '@/lib/agent/llm'"

- [ ] **Step 3: Buat `lib/agent/llm.ts`**

```ts
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ZodType } from 'zod';
import type { LlmClient } from '@/lib/domain';

export class LlmOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmOutputError';
  }
}

export type ChatParser = Pick<OpenAI, 'chat'>;

export function createOpenAiLlm(opts: { apiKey: string; model: string; client?: ChatParser }): LlmClient {
  const client = opts.client ?? new OpenAI({ apiKey: opts.apiKey });
  return {
    async parse<T>({ schema, name, system, user }: { schema: ZodType<T>; name: string; system: string; user: string }): Promise<T> {
      const completion = await client.chat.completions.parse({
        model: opts.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: zodResponseFormat(schema, name),
      });
      const parsed = completion.choices[0]?.message.parsed;
      if (parsed === null || parsed === undefined) throw new LlmOutputError(`LLM returned no parsed output for ${name}`);
      return parsed as T;
    },
  };
}

export type FakeResponse = unknown | ((user: string, callIndex: number) => unknown);

export function createFakeLlm(
  responses: Record<string, FakeResponse>,
): LlmClient & { calls: Array<{ name: string; user: string }> } {
  const calls: Array<{ name: string; user: string }> = [];
  return {
    calls,
    async parse<T>({ schema, name, user }: { schema: ZodType<T>; name: string; system: string; user: string }): Promise<T> {
      const callIndex = calls.filter((c) => c.name === name).length;
      calls.push({ name, user });
      if (!(name in responses)) throw new LlmOutputError(`No fake LLM response for "${name}"`);
      const r = responses[name];
      const value = typeof r === 'function' ? (r as (u: string, i: number) => unknown)(user, callIndex) : r;
      return schema.parse(value);
    },
  };
}
```

Kalau `pnpm typecheck` melaporkan `chat.completions.parse` tidak ada, berarti versi openai yang terpasang adalah v4. Pastikan `openai@^5` terpasang (`pnpm add openai@^5`). Di v4, method-nya ada di `client.beta.chat.completions.parse`.

- [ ] **Step 4: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/agent/llm.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent/llm.ts tests/agent/llm.test.ts
git commit -m "feat(agent): OpenAI structured-output client and fake LLM for tests"
```

---

### Task 10: Ekstraksi profil event (LLM)

**Files:**
- Create: `lib/agent/profile.ts`, `tests/agent/profile.test.ts`

**Interfaces:**
- Consumes: `LlmClient`, `EventInput` (T1), `createFakeLlm` (T9, di test).
- Produces:
  - `EVENT_TYPES = ['kebijakan','makro','geopolitik','komoditas','korporasi','hukum','lainnya']`, `INDEX_HINTS = ['IDXBUMN20','LQ45','IDX30','JII70']`
  - `EventProfileSchema`, `type EventProfile = { summary; event_type; themes; mentioned_companies: {name; symbol|null}[]; sub_sectors; index_hints; group_names; hypotheses: {sub_sector; direction: 'negatif'|'positif'|'tidak jelas'; reason}[] }`
  - `PROFILE_SCHEMA_NAME = 'event_profile'`
  - `buildProfilePrompt(event, allowedSubSectors): { system: string; user: string }`
  - `extractEventProfile(llm, event, allowedSubSectors): Promise<EventProfile>`: retry 1×. Subsektor dan hipotesis disaring ke daftar yang diizinkan, lalu ditulis ulang dengan ejaan kanonik
  - `class ProfileExtractionError`

- [ ] **Step 1: Tulis test yang gagal di `tests/agent/profile.test.ts`**

```ts
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
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/agent/profile.test.ts`
Expected: FAIL, "Cannot find module '@/lib/agent/profile'"

- [ ] **Step 3: Buat `lib/agent/profile.ts`**

```ts
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
```

- [ ] **Step 4: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/agent/profile.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent/profile.ts tests/agent/profile.test.ts
git commit -m "feat(agent): event profile extraction with sub-sector whitelist and retry"
```

---

### Task 11: Penyusunan kandidat saham (fungsi murni)

**Files:**
- Create: `lib/agent/candidates.ts`, `tests/agent/candidates.test.ts`

**Interfaces:**
- Consumes: `EventProfile` (T10), `Company`, `Candidate`, `LinkType`, `normalizeSymbol` (T1).
- Produces:
  - Konstanta: `MAX_EVIDENCE = 6`, `PER_GROUP = 3`, `PER_INDEX = 4`, `PER_SUBSECTOR = 2`, `MAX_GROUPS = 2`
  - `uniqueSubSectors(universe: Company[]): string[]` (urut abjad)
  - `simplifyName(name: string): string`
  - `directSymbols(profile, sourceSymbols: string[], universe): string[]`
  - `interface CandidateInputs { profile; sourceSymbols: string[]; universe: Company[]; groupMembers: Record<string, string[]>; indexMembers: Record<string, string[]> }`
  - `buildCandidates(i: CandidateInputs): { evidence: Candidate[]; other: Candidate[] }`

Aturan: kode saham yang tidak ada di universe dibuang. Urutan prioritas `direct` → `group` → `index` → `sector`, dan di dalam setiap kelompok diurutkan dari market cap terbesar. Setiap saham hanya muncul sekali, dengan jenis kaitan prioritas tertinggi. Enam kandidat pertama masuk `evidence` (`withEvidence: true`), sisanya masuk `other`.

- [ ] **Step 1: Tulis test yang gagal di `tests/agent/candidates.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildCandidates, directSymbols, simplifyName, uniqueSubSectors } from '@/lib/agent/candidates';
import type { EventProfile } from '@/lib/agent/profile';
import type { Company } from '@/lib/domain';

const universe: Company[] = [
  { symbol: 'BBRI', name: 'PT Bank Rakyat Indonesia (Persero) Tbk', subSector: 'Banks', marketCap: 6e14 },
  { symbol: 'BMRI', name: 'PT Bank Mandiri (Persero) Tbk', subSector: 'Banks', marketCap: 5e14 },
  { symbol: 'BBNI', name: 'PT Bank Negara Indonesia (Persero) Tbk', subSector: 'Banks', marketCap: 1.5e14 },
  { symbol: 'TLKM', name: 'PT Telkom Indonesia (Persero) Tbk', subSector: 'Telecommunication', marketCap: 3e14 },
  { symbol: 'ADRO', name: 'PT Alamtri Resources Indonesia Tbk', subSector: 'Coal', marketCap: 6e13 },
  { symbol: 'ANTM', name: 'PT Aneka Tambang Tbk', subSector: 'Metals', marketCap: 4e13 },
  { symbol: 'PTBA', name: 'PT Bukit Asam Tbk', subSector: 'Coal', marketCap: 3e13 },
];

function profile(overrides: Partial<EventProfile> = {}): EventProfile {
  return {
    summary: 's',
    event_type: 'kebijakan',
    themes: [],
    mentioned_companies: [],
    sub_sectors: [],
    index_hints: [],
    group_names: [],
    hypotheses: [],
    ...overrides,
  };
}

describe('helpers', () => {
  it('lists unique sub-sectors alphabetically', () => {
    expect(uniqueSubSectors(universe)).toEqual(['Banks', 'Coal', 'Metals', 'Telecommunication']);
  });
  it('simplifies company names', () => {
    expect(simplifyName('PT Bank Mandiri (Persero) Tbk')).toBe('bank mandiri');
  });
});

describe('directSymbols', () => {
  it('drops fictional symbols and matches companies by name', () => {
    const p = profile({
      mentioned_companies: [
        { name: 'Perusahaan Fiktif', symbol: 'ZZZZ' },
        { name: 'Bank Mandiri', symbol: null },
      ],
    });
    expect(directSymbols(p, ['bbri.jk', 'QQQQ'], universe)).toEqual(['BBRI', 'BMRI']);
  });
});

describe('buildCandidates', () => {
  it('orders by link priority, dedupes and ranks by market cap', () => {
    const { evidence, other } = buildCandidates({
      profile: profile({ sub_sectors: ['Coal'] }),
      sourceSymbols: ['BBRI'],
      universe,
      groupMembers: { Adaro: ['ADRO'] },
      indexMembers: { IDXBUMN20: ['PTBA', 'BBRI', 'ANTM', 'TLKM', 'BBNI'] },
    });
    expect(evidence.map((c) => [c.symbol, c.linkType])).toEqual([
      ['BBRI', 'direct'],
      ['ADRO', 'group'],
      ['TLKM', 'index'],
      ['BBNI', 'index'],
      ['ANTM', 'index'],
      ['PTBA', 'sector'],
    ]);
    expect(evidence.every((c) => c.withEvidence)).toBe(true);
    expect(other).toEqual([]);
    expect(evidence[1].reason).toBe('Satu grup usaha: Adaro');
  });

  it('moves candidates beyond six into other links', () => {
    const { evidence, other } = buildCandidates({
      profile: profile({ sub_sectors: ['Banks', 'Coal', 'Telecommunication'] }),
      sourceSymbols: ['ANTM', 'BBNI'],
      universe,
      groupMembers: {},
      indexMembers: {},
    });
    expect(evidence.map((c) => c.symbol)).toEqual(['ANTM', 'BBNI', 'BBRI', 'BMRI', 'ADRO', 'PTBA']);
    expect(other.map((c) => [c.symbol, c.withEvidence])).toEqual([['TLKM', false]]);
  });
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/agent/candidates.test.ts`
Expected: FAIL, "Cannot find module '@/lib/agent/candidates'"

- [ ] **Step 3: Buat `lib/agent/candidates.ts`**

```ts
import { normalizeSymbol, type Candidate, type Company, type LinkType } from '@/lib/domain';
import type { EventProfile } from './profile';

export const MAX_EVIDENCE = 6;
export const PER_GROUP = 3;
export const PER_INDEX = 4;
export const PER_SUBSECTOR = 2;
export const MAX_GROUPS = 2;
const MIN_NAME_MATCH_LENGTH = 4;

export function uniqueSubSectors(universe: Company[]): string[] {
  return [...new Set(universe.map((c) => c.subSector).filter((s): s is string => Boolean(s)))].sort();
}

export function simplifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(persero\)|\bpt\b|\btbk\b|[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function directSymbols(profile: EventProfile, sourceSymbols: string[], universe: Company[]): string[] {
  const known = new Set(universe.map((c) => c.symbol));
  const out: string[] = [];
  const push = (s: string) => {
    const n = normalizeSymbol(s);
    if (known.has(n) && !out.includes(n)) out.push(n);
  };
  sourceSymbols.forEach(push);
  for (const m of profile.mentioned_companies) {
    if (m.symbol && known.has(normalizeSymbol(m.symbol))) {
      push(m.symbol);
      continue;
    }
    const needle = simplifyName(m.name);
    if (needle.length < MIN_NAME_MATCH_LENGTH) continue;
    const hit = universe.find((c) => simplifyName(c.name).includes(needle));
    if (hit) push(hit.symbol);
  }
  return out;
}

export interface CandidateInputs {
  profile: EventProfile;
  sourceSymbols: string[];
  universe: Company[];
  groupMembers: Record<string, string[]>;
  indexMembers: Record<string, string[]>;
}

export function buildCandidates(i: CandidateInputs): { evidence: Candidate[]; other: Candidate[] } {
  const bySymbol = new Map(i.universe.map((c) => [c.symbol, c]));
  const list: Candidate[] = [];
  const add = (symbol: string, linkType: LinkType, reason: string) => {
    const n = normalizeSymbol(symbol);
    const company = bySymbol.get(n);
    if (!company || list.some((c) => c.symbol === n)) return;
    list.push({
      symbol: n,
      name: company.name,
      subSector: company.subSector,
      marketCap: company.marketCap,
      linkType,
      reason,
      withEvidence: false,
    });
  };
  const byMarketCap = (symbols: string[]) =>
    symbols
      .map(normalizeSymbol)
      .filter((s) => bySymbol.has(s))
      .sort((a, b) => (bySymbol.get(b)?.marketCap ?? 0) - (bySymbol.get(a)?.marketCap ?? 0));

  for (const s of directSymbols(i.profile, i.sourceSymbols, i.universe)) add(s, 'direct', 'Disebut langsung dalam berita');
  for (const [group, members] of Object.entries(i.groupMembers)) {
    for (const s of byMarketCap(members).slice(0, PER_GROUP)) add(s, 'group', `Satu grup usaha: ${group}`);
  }
  for (const [code, members] of Object.entries(i.indexMembers)) {
    for (const s of byMarketCap(members).slice(0, PER_INDEX)) add(s, 'index', `Anggota indeks ${code}`);
  }
  for (const sub of i.profile.sub_sectors) {
    const members = i.universe.filter((c) => c.subSector?.toLowerCase() === sub.toLowerCase()).map((c) => c.symbol);
    for (const s of byMarketCap(members).slice(0, PER_SUBSECTOR)) add(s, 'sector', `Subsektor ${sub}`);
  }

  return {
    evidence: list.slice(0, MAX_EVIDENCE).map((c) => ({ ...c, withEvidence: true })),
    other: list.slice(MAX_EVIDENCE),
  };
}
```

- [ ] **Step 4: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/agent/candidates.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent/candidates.ts tests/agent/candidates.test.ts
git commit -m "feat(agent): data-backed candidate builder with link priority and evidence cap"
```

---

### Task 12: Penjaga kata terlarang, disclaimer, dan skor keyakinan

**Files:**
- Create: `lib/explain/guard.ts`, `lib/explain/confidence.ts`, `tests/explain/guard.test.ts`, `tests/explain/confidence.test.ts`

**Interfaces:**
- Consumes: `Candidate`, `Reaction`, `Confidence` (T1).
- Produces:
  - `DISCLAIMER` (teks persis dari spec §7), `BANNED_PHRASES`, `findBannedPhrases(text: string): string[]`
  - `scoreRetrospective(c: Candidate, r: Reaction | null, marketWide: boolean): Confidence`
  - `PROSPECTIVE_MIN_ANALOGS = 3`, `scoreProspective(analogEventCount: number): Confidence`

- [ ] **Step 1: Tulis test yang gagal**

`tests/explain/guard.test.ts`:
```ts
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
```

`tests/explain/confidence.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { scoreProspective, scoreRetrospective } from '@/lib/explain/confidence';
import { makeCandidate, makeReaction } from '../helpers/factories';

describe('scoreRetrospective', () => {
  it('is tinggi only for significant, non-market-wide, direct/group links', () => {
    expect(scoreRetrospective(makeCandidate({ linkType: 'direct' }), makeReaction(), false)).toBe('tinggi');
    expect(scoreRetrospective(makeCandidate({ linkType: 'group' }), makeReaction(), false)).toBe('tinggi');
    expect(scoreRetrospective(makeCandidate({ linkType: 'direct' }), makeReaction(), true)).toBe('sedang');
    expect(scoreRetrospective(makeCandidate({ linkType: 'sector' }), makeReaction(), false)).toBe('sedang');
  });
  it('is rendah without a significant reaction', () => {
    expect(scoreRetrospective(makeCandidate(), makeReaction({ significant: false }), false)).toBe('rendah');
    expect(scoreRetrospective(makeCandidate(), null, false)).toBe('rendah');
  });
});

describe('scoreProspective', () => {
  it('never exceeds sedang', () => {
    expect(scoreProspective(0)).toBe('rendah');
    expect(scoreProspective(2)).toBe('rendah');
    expect(scoreProspective(3)).toBe('sedang');
    expect(scoreProspective(50)).toBe('sedang');
  });
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/explain`
Expected: FAIL, modul tidak ditemukan.

- [ ] **Step 3: Buat `lib/explain/guard.ts`**

```ts
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
```

- [ ] **Step 4: Buat `lib/explain/confidence.ts`**

```ts
import type { Candidate, Confidence, Reaction } from '@/lib/domain';

export const PROSPECTIVE_MIN_ANALOGS = 3;

export function scoreRetrospective(c: Candidate, r: Reaction | null, marketWide: boolean): Confidence {
  if (!r || !r.significant) return 'rendah';
  if (!marketWide && (c.linkType === 'direct' || c.linkType === 'group')) return 'tinggi';
  return 'sedang';
}

/** Prospective findings are hypotheses: never 'tinggi'. */
export function scoreProspective(analogEventCount: number): Confidence {
  return analogEventCount >= PROSPECTIVE_MIN_ANALOGS ? 'sedang' : 'rendah';
}
```

- [ ] **Step 5: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/explain && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/explain tests/explain
git commit -m "feat(explain): banned-phrase guard, disclaimer and confidence scoring"
```

---

### Task 13: Narasi laporan (LLM + fallback template) dan formatter

**Files:**
- Create: `lib/format.ts`, `lib/explain/narrate.ts`, `tests/format.test.ts`, `tests/explain/narrate.test.ts`

**Interfaces:**
- Consumes: `findBannedPhrases` (T12), `LlmClient`, `AnalogSummary`, `Confidence`, `LinkType`, `Mode`, `normalizeSymbol` (T1), `createFakeLlm` (T9, di test).
- Produces:
  - `formatPct(x: number): string` (contoh `-7,2%` dan `+1,5%`), `formatIdrBillion(x: number): string` (contoh `Rp 5,0 miliar`)
  - `NARRATIVE_SCHEMA_NAME = 'narrative'`, `NarrativeSchema`, `type Narrative = { headline: string; chain: string[]; explanations: { symbol: string; text: string }[] }`
  - `interface NarrationFinding { symbol; name; linkType; reason; car: number | null; significant: boolean | null; netForeignInflow: number | null; confidence }`
  - `interface NarrationInput { mode; title; summary; ihsgReturn: number | null; marketWide: boolean; findings: NarrationFinding[]; analogs: AnalogSummary[] }`
  - `templateNarrative(input): Narrative`, `narrate(llm, input): Promise<Narrative>`. Prompt user = `JSON.stringify(input, null, 2)`. Maksimal 2 percobaan. Kalau gagal, hasilnya template. Mode prospektif selalu diawali `HIPOTESIS`. Setiap finding pasti punya penjelasan.

- [ ] **Step 1: Tulis test yang gagal**

`tests/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatIdrBillion, formatPct } from '@/lib/format';

describe('format', () => {
  it('formats percentages with Indonesian decimal comma and sign', () => {
    expect(formatPct(-0.072)).toBe('-7,2%');
    expect(formatPct(0.015)).toBe('+1,5%');
    expect(formatPct(0)).toBe('0,0%');
  });
  it('formats IDR in billions without sign', () => {
    expect(formatIdrBillion(-5_000_000_000)).toBe('Rp 5,0 miliar');
    expect(formatIdrBillion(146_476_750_000)).toBe('Rp 146,5 miliar');
  });
});
```

`tests/explain/narrate.test.ts`:
```ts
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
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/format.test.ts tests/explain/narrate.test.ts`
Expected: FAIL, modul tidak ditemukan.

- [ ] **Step 3: Buat `lib/format.ts`**

```ts
export function formatPct(x: number): string {
  const s = (x * 100).toFixed(1).replace('.', ',');
  return `${x > 0 ? '+' : ''}${s}%`;
}

export function formatIdrBillion(x: number): string {
  return `Rp ${(Math.abs(x) / 1e9).toFixed(1).replace('.', ',')} miliar`;
}
```

- [ ] **Step 4: Buat `lib/explain/narrate.ts`**

```ts
import { z } from 'zod';
import { normalizeSymbol, type AnalogSummary, type Confidence, type LinkType, type LlmClient, type Mode } from '@/lib/domain';
import { formatIdrBillion, formatPct } from '@/lib/format';
import { findBannedPhrases } from './guard';

export const NARRATIVE_SCHEMA_NAME = 'narrative';

export const NarrativeSchema = z.object({
  headline: z.string(),
  chain: z.array(z.string()),
  explanations: z.array(z.object({ symbol: z.string(), text: z.string() })),
});

export type Narrative = z.infer<typeof NarrativeSchema>;

export interface NarrationFinding {
  symbol: string;
  name: string;
  linkType: LinkType;
  reason: string;
  car: number | null;
  significant: boolean | null;
  netForeignInflow: number | null;
  confidence: Confidence;
}

export interface NarrationInput {
  mode: Mode;
  title: string;
  summary: string;
  ihsgReturn: number | null;
  marketWide: boolean;
  findings: NarrationFinding[];
  analogs: AnalogSummary[];
}

const SYSTEM = [
  'Tulis penjelasan singkat berbahasa Indonesia untuk investor pemula, HANYA berdasarkan DATA JSON yang diberikan.',
  'Jangan menambah fakta atau angka di luar data. Angka persen tulis dengan koma desimal (contoh -7,2%).',
  'Dilarang memberi saran investasi dan dilarang memakai kata: beli, jual, rekomendasi, target harga, pasti naik, pasti turun, wajib, buy, sell, hold.',
  "Untuk foreign flow gunakan frasa persis 'net beli asing' atau 'net jual asing'.",
  'Kalau mode = prospective, tegaskan bahwa ini hipotesis karena belum ada hari bursa setelah event.',
  'Kalau marketWide = true, jelaskan bahwa pasar secara luas juga bergerak sehingga keterkaitannya lebih lemah.',
  'headline: satu kalimat. chain: 2–4 langkah sebab-akibat. explanations: satu per symbol, 1–2 kalimat.',
].join('\n');

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function explainFinding(f: NarrationFinding): string {
  const parts = [`${f.name} (${f.symbol}) terkait karena ${lowerFirst(f.reason)}.`];
  if (f.car === null) {
    parts.push('Data harga belum cukup untuk mengukur reaksi.');
  } else {
    parts.push(
      `Abnormal return kumulatif ${formatPct(f.car)} dibanding IHSG (${f.significant ? 'signifikan secara statistik' : 'masih dalam batas pergerakan normal'}).`,
    );
  }
  if (f.netForeignInflow !== null && f.netForeignInflow !== 0) {
    parts.push(
      `Investor asing mencatat ${f.netForeignInflow < 0 ? 'net jual asing' : 'net beli asing'} ${formatIdrBillion(f.netForeignInflow)} pada periode yang sama.`,
    );
  }
  return parts.join(' ');
}

export function templateNarrative(input: NarrationInput): Narrative {
  const headline =
    input.mode === 'retrospective'
      ? 'Bagaimana pasar bereaksi terhadap berita ini'
      : 'HIPOTESIS: saham yang berpotensi terkait dengan berita ini';
  const chain: string[] = [];
  if (findBannedPhrases(input.summary).length === 0) chain.push(input.summary);
  if (input.mode === 'retrospective' && input.ihsgReturn !== null) {
    chain.push(
      input.marketWide
        ? `IHSG bergerak ${formatPct(input.ihsgReturn)} pada hari event, jadi pergerakan pasar secara luas ikut berperan.`
        : `IHSG bergerak ${formatPct(input.ihsgReturn)} pada hari event, relatif stabil.`,
    );
  }
  if (input.mode === 'prospective') {
    chain.push('Belum ada hari bursa setelah event, jadi keterkaitan di bawah adalah hipotesis berdasarkan data historis.');
  }
  for (const a of input.analogs.slice(0, 2)) {
    chain.push(`Pada ${a.eventCount} event serupa sebelumnya, subsektor ${a.subSector} rata-rata bergerak ${formatPct(a.avgCar)} dibanding IHSG.`);
  }
  return { headline, chain, explanations: input.findings.map((f) => ({ symbol: f.symbol, text: explainFinding(f) })) };
}

const allText = (n: Narrative) => [n.headline, ...n.chain, ...n.explanations.map((e) => e.text)].join('\n');

export async function narrate(llm: LlmClient, input: NarrationInput): Promise<Narrative> {
  const fallback = templateNarrative(input);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const n = await llm.parse({
        schema: NarrativeSchema,
        name: NARRATIVE_SCHEMA_NAME,
        system: SYSTEM,
        user: JSON.stringify(input, null, 2),
      });
      if (findBannedPhrases(allText(n)).length > 0) continue;
      const bySymbol = new Map(n.explanations.map((e) => [normalizeSymbol(e.symbol), e.text]));
      const headline =
        input.mode === 'prospective' && !n.headline.toUpperCase().startsWith('HIPOTESIS') ? `HIPOTESIS: ${n.headline}` : n.headline;
      return {
        headline,
        chain: n.chain,
        explanations: fallback.explanations.map((e) => ({ symbol: e.symbol, text: bySymbol.get(e.symbol) ?? e.text })),
      };
    } catch {
      // try again, then fall back to the template
    }
  }
  return fallback;
}
```

- [ ] **Step 5: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/format.test.ts tests/explain && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/format.ts lib/explain/narrate.ts tests/format.test.ts tests/explain/narrate.test.ts
git commit -m "feat(explain): guarded LLM narrative with deterministic template fallback"
```

---

### Task 14: Pola historis (analog) dari laporan tersimpan

**Files:**
- Create: `lib/history/analogs.ts`, `tests/history/analogs.test.ts`

**Interfaces:**
- Consumes: `Report`, `AnalogSummary` (T1), `makeReport`, `makeCandidate`, `makeReaction` (T2, di test).
- Produces: `findAnalogs(reports: Report[], eventType: string, subSectors: string[], excludeEventId?: string): AnalogSummary[]`. Hanya laporan retrospektif dengan `eventType` yang sama. Dihitung per subsektor yang diminta (tidak peka huruf besar-kecil): `eventCount` = jumlah event berbeda, `avgCar` = rata-rata CAR temuan. Diurutkan dari `eventCount` terbanyak.

- [ ] **Step 1: Tulis test yang gagal di `tests/history/analogs.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { findAnalogs } from '@/lib/history/analogs';
import { makeCandidate, makeReaction, makeReport } from '../helpers/factories';

function finding(symbol: string, subSector: string, car: number | null) {
  return {
    candidate: makeCandidate({ symbol, subSector }),
    reaction: car === null ? null : makeReaction({ car }),
    netForeignInflow: null,
    confidence: 'sedang' as const,
    explanation: '',
    dataNote: null,
  };
}

const reports = [
  makeReport({ eventId: 'e1', eventType: 'kebijakan', findings: [finding('BBRI', 'Banks', -0.06), finding('BMRI', 'Banks', -0.02)] }),
  makeReport({ eventId: 'e2', eventType: 'kebijakan', findings: [finding('BBNI', 'Banks', -0.04), finding('PTBA', 'Coal', 0.03)] }),
  makeReport({ eventId: 'e3', eventType: 'makro', findings: [finding('BBCA', 'Banks', 0.05)] }),
  makeReport({ eventId: 'e4', eventType: 'kebijakan', mode: 'prospective', findings: [finding('BBRI', 'Banks', null)] }),
];

describe('findAnalogs', () => {
  it('aggregates matching retrospective reports per requested sub-sector', () => {
    const out = findAnalogs(reports, 'kebijakan', ['banks']);
    expect(out).toHaveLength(1);
    expect(out[0].subSector).toBe('Banks');
    expect(out[0].eventCount).toBe(2);
    expect(out[0].avgCar).toBeCloseTo(-0.04, 10);
  });

  it('excludes the current event and unrelated sub-sectors', () => {
    const out = findAnalogs(reports, 'kebijakan', ['Banks', 'Coal'], 'e1');
    expect(out.map((a) => [a.subSector, a.eventCount])).toEqual([
      ['Banks', 1],
      ['Coal', 1],
    ]);
  });

  it('returns nothing without matching history', () => {
    expect(findAnalogs(reports, 'geopolitik', ['Banks'])).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/history/analogs.test.ts`
Expected: FAIL, "Cannot find module '@/lib/history/analogs'"

- [ ] **Step 3: Buat `lib/history/analogs.ts`**

```ts
import type { AnalogSummary, Report } from '@/lib/domain';

export function findAnalogs(
  reports: Report[],
  eventType: string,
  subSectors: string[],
  excludeEventId?: string,
): AnalogSummary[] {
  const wanted = new Set(subSectors.map((s) => s.toLowerCase()));
  const acc = new Map<string, { subSector: string; cars: number[]; events: Set<string> }>();
  for (const r of reports) {
    if (r.mode !== 'retrospective' || r.eventType !== eventType || r.eventId === excludeEventId) continue;
    for (const f of r.findings) {
      const sub = f.candidate.subSector;
      if (!sub || !f.reaction || !wanted.has(sub.toLowerCase())) continue;
      const key = sub.toLowerCase();
      const entry = acc.get(key) ?? { subSector: sub, cars: [], events: new Set<string>() };
      entry.cars.push(f.reaction.car);
      entry.events.add(r.eventId);
      acc.set(key, entry);
    }
  }
  return [...acc.values()]
    .map((e) => ({
      subSector: e.subSector,
      eventCount: e.events.size,
      avgCar: e.cars.reduce((s, x) => s + x, 0) / e.cars.length,
    }))
    .sort((a, b) => b.eventCount - a.eventCount || a.subSector.localeCompare(b.subSector));
}
```

- [ ] **Step 4: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/history && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/history tests/history
git commit -m "feat(history): historical analogs from stored retrospective reports"
```

---

### Task 15: Input event: ekstraksi artikel, berita Sectors, input manual

**Files:**
- Create: `lib/events/article.ts`, `lib/events/news.ts`, `lib/events/manual.ts`, `tests/events/article.test.ts`, `tests/events/news.test.ts`, `tests/events/manual.test.ts`

**Interfaces:**
- Consumes: `EventInput`, `normalizeSymbol` (T1), `NewsArticle` (T5).
- Produces:
  - `MIN_TEXT_LENGTH = 300`, `FETCH_TIMEOUT_MS = 10_000`, `class ArticleFetchError`, `interface Article { title: string; text: string; publishedAt: string | null }`
  - `extractArticle(html: string): Article`, `fetchArticle(url: string, fetchImpl?: typeof fetch): Promise<Article>`
  - `newsToEvent(a: NewsArticle): EventInput` (`source: 'feed'`)
  - `MIN_MANUAL_TEXT = 80`, `class InputError`, `interface ManualRequest { url?: string; text?: string; title?: string; date?: string }`
  - `manualEvent(p: { url: string | null; title: string; text: string; publishedAt: string }): EventInput`
  - `buildManualEvent(req: ManualRequest, today: string, fetchImpl?: typeof fetch): Promise<EventInput>`. Teks lebih diutamakan daripada link. Urutan tanggal: `req.date`, lalu meta artikel, lalu `today`.

- [ ] **Step 1: Tulis test yang gagal**

`tests/events/article.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { ArticleFetchError, extractArticle, fetchArticle } from '@/lib/events/article';

const para = 'Pemerintah mengumumkan kebijakan baru untuk sektor perbankan nasional pada pekan ini. '.repeat(6);
const html = `<!doctype html><html><head><title>Kebijakan Bank BUMN</title>
<meta property="article:published_time" content="2026-03-07T09:00:00+07:00"></head>
<body><nav>Menu Beranda Kategori</nav><article><h1>Kebijakan Bank BUMN</h1><p>${para}</p><p>${para}</p></article>
<footer>Hak cipta</footer></body></html>`;

describe('extractArticle', () => {
  it('extracts readable text, a title and the published time', () => {
    const a = extractArticle(html);
    expect(a.title.length).toBeGreaterThan(0);
    expect(a.text).toContain('Pemerintah mengumumkan kebijakan baru');
    expect(a.text.length).toBeGreaterThanOrEqual(300);
    expect(a.publishedAt).toBe('2026-03-07T09:00:00+07:00');
  });

  it('rejects pages without enough text', () => {
    expect(() => extractArticle('<html><body><p>Berlangganan untuk membaca.</p></body></html>')).toThrow(ArticleFetchError);
  });
});

describe('fetchArticle', () => {
  it('fetches and extracts', async () => {
    const fetchImpl = vi.fn(async () => new Response(html, { status: 200 }));
    const a = await fetchArticle('https://example.com/a', fetchImpl as unknown as typeof fetch);
    expect(a.text).toContain('sektor perbankan');
  });

  it('turns HTTP errors and network failures into ArticleFetchError', async () => {
    const forbidden = vi.fn(async () => new Response('no', { status: 403 }));
    await expect(fetchArticle('https://example.com/a', forbidden as unknown as typeof fetch)).rejects.toThrow('403');
    const down = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(fetchArticle('https://example.com/a', down as unknown as typeof fetch)).rejects.toBeInstanceOf(ArticleFetchError);
  });
});
```

`tests/events/news.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { newsToEvent } from '@/lib/events/news';

describe('newsToEvent', () => {
  it('maps a Sectors news article to a feed event', () => {
    expect(
      newsToEvent({
        title: 'Judul',
        body: 'Isi',
        source: 'https://example.com/n1',
        timestamp: '2026-07-09T18:05:00',
        sector: 'financials',
        sub_sector: ['insurance'],
        tags: ['Bearish'],
        symbols: ['bbri.jk'],
      }),
    ).toEqual({
      source: 'feed',
      url: 'https://example.com/n1',
      title: 'Judul',
      body: 'Isi',
      publishedAt: '2026-07-09T18:05:00',
      symbols: ['BBRI'],
      tags: ['Bearish'],
      subSectors: ['insurance'],
    });
  });

  it('tolerates missing optional fields', () => {
    const e = newsToEvent({ title: 'T', source: 'https://example.com/n2', timestamp: '2026-07-09T08:00:00', body: null, symbols: null, tags: null, sub_sector: null });
    expect(e).toMatchObject({ body: '', symbols: [], tags: [], subSectors: [] });
  });
});
```

`tests/events/manual.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { buildManualEvent, InputError } from '@/lib/events/manual';

const TODAY = '2026-09-22';
const longText = 'Presiden menyampaikan pidato tentang rencana pengelolaan BUMN melalui badan investasi baru. '.repeat(3);

describe('buildManualEvent', () => {
  it('prefers pasted text and derives a title from the first sentence', async () => {
    const e = await buildManualEvent({ text: longText, date: '2026-03-07' }, TODAY);
    expect(e).toMatchObject({ source: 'manual', url: null, publishedAt: '2026-03-07', symbols: [] });
    expect(e.title).toBe('Presiden menyampaikan pidato tentang rencana pengelolaan BUMN melalui badan investasi baru.');
  });

  it('defaults the date to today', async () => {
    expect((await buildManualEvent({ text: longText }, TODAY)).publishedAt).toBe(TODAY);
  });

  it('rejects text that is too short and empty requests', async () => {
    await expect(buildManualEvent({ text: 'pendek' }, TODAY)).rejects.toBeInstanceOf(InputError);
    await expect(buildManualEvent({}, TODAY)).rejects.toBeInstanceOf(InputError);
  });

  it('fetches the URL when no text is given and uses the article date', async () => {
    const para = 'Pemerintah mengumumkan kebijakan baru untuk sektor perbankan nasional pada pekan ini. '.repeat(6);
    const html = `<html><head><title>Kebijakan</title><meta property="article:published_time" content="2026-03-06T20:00:00+07:00"></head><body><article><p>${para}</p></article></body></html>`;
    const fetchImpl = vi.fn(async () => new Response(html, { status: 200 }));
    const e = await buildManualEvent({ url: 'https://example.com/b' }, TODAY, fetchImpl as unknown as typeof fetch);
    expect(e.url).toBe('https://example.com/b');
    expect(e.publishedAt).toBe('2026-03-06T20:00:00+07:00');
  });
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/events`
Expected: FAIL, modul tidak ditemukan.

- [ ] **Step 3: Buat `lib/events/article.ts`**

```ts
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

export const MIN_TEXT_LENGTH = 300;
export const FETCH_TIMEOUT_MS = 10_000;

export class ArticleFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArticleFetchError';
  }
}

export interface Article {
  title: string;
  text: string;
  publishedAt: string | null;
}

const PASTE_HINT = 'Silakan tempel teks beritanya.';

export function extractArticle(html: string): Article {
  const { document } = parseHTML(html);
  const publishedAt =
    document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ??
    document.querySelector('meta[name="pubdate"]')?.getAttribute('content') ??
    null;
  const pageTitle = document.querySelector('title')?.textContent?.trim() ?? '';
  const bodyText = document.body?.textContent ?? '';
  const parsed = new Readability(document as unknown as Document).parse();
  const text = (parsed?.textContent || bodyText).replace(/\s+/g, ' ').trim();
  if (text.length < MIN_TEXT_LENGTH) {
    throw new ArticleFetchError(`Teks artikel terlalu pendek atau tidak terbaca (mungkin paywall). ${PASTE_HINT}`);
  }
  return { title: parsed?.title?.trim() || pageTitle || 'Tanpa judul', text, publishedAt };
}

export async function fetchArticle(url: string, fetchImpl: typeof fetch = fetch): Promise<Article> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CorrelationExplainer/1.0)' },
    });
  } catch {
    throw new ArticleFetchError(`Link tidak bisa diakses (timeout atau jaringan). ${PASTE_HINT}`);
  }
  if (!res.ok) throw new ArticleFetchError(`Link mengembalikan status ${res.status}. ${PASTE_HINT}`);
  return extractArticle(await res.text());
}
```

- [ ] **Step 4: Buat `lib/events/news.ts`**

```ts
import { normalizeSymbol, type EventInput } from '@/lib/domain';
import type { NewsArticle } from '@/lib/sectors/schemas';

export function newsToEvent(a: NewsArticle): EventInput {
  return {
    source: 'feed',
    url: a.source,
    title: a.title,
    body: a.body ?? '',
    publishedAt: a.timestamp,
    symbols: (a.symbols ?? []).map(normalizeSymbol),
    tags: a.tags ?? [],
    subSectors: a.sub_sector ?? [],
  };
}
```

- [ ] **Step 5: Buat `lib/events/manual.ts`**

```ts
import type { EventInput } from '@/lib/domain';
import { fetchArticle } from './article';

export const MIN_MANUAL_TEXT = 80;
const MAX_TITLE = 120;

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

export interface ManualRequest {
  url?: string;
  text?: string;
  title?: string;
  date?: string;
}

export function manualEvent(p: { url: string | null; title: string; text: string; publishedAt: string }): EventInput {
  return { source: 'manual', url: p.url, title: p.title, body: p.text, publishedAt: p.publishedAt, symbols: [], tags: [], subSectors: [] };
}

function firstSentence(text: string): string {
  const sentence = text.split(/(?<=[.!?])\s/)[0].trim();
  return sentence.length > MAX_TITLE ? `${sentence.slice(0, MAX_TITLE - 3)}...` : sentence;
}

export async function buildManualEvent(req: ManualRequest, today: string, fetchImpl: typeof fetch = fetch): Promise<EventInput> {
  const text = req.text?.trim();
  if (text) {
    if (text.length < MIN_MANUAL_TEXT) throw new InputError(`Teks berita terlalu pendek (minimal ${MIN_MANUAL_TEXT} karakter).`);
    return manualEvent({
      url: req.url ?? null,
      title: req.title?.trim() || firstSentence(text),
      text,
      publishedAt: req.date ?? today,
    });
  }
  if (req.url) {
    const article = await fetchArticle(req.url, fetchImpl);
    return manualEvent({
      url: req.url,
      title: req.title?.trim() || article.title,
      text: article.text,
      publishedAt: req.date ?? article.publishedAt ?? today,
    });
  }
  throw new InputError('Isi link berita atau tempel teks beritanya.');
}
```

- [ ] **Step 6: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/events && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/events tests/events
git commit -m "feat(events): article extraction, Sectors news mapping and manual input"
```

---

### Task 16: Pipeline `analyzeEvent`, data pasar palsu, dan wiring dari env

**Files:**
- Create: `lib/sectors/fake.ts`, `lib/agent/from-env.ts`, `lib/pipeline/analyze.ts`, `lib/pipeline/from-env.ts`, `tests/sectors/fake.test.ts`, `tests/pipeline/analyze.test.ts`

**Interfaces:**
- Consumes: hampir semua modul sebelumnya: repo (T2), `CreditLedger`, `dbLedger`, `memoryLedger`, `CreditBudgetError` (T3), `FixtureMissingError`, `SectorsHttpError` (T4), `sectorsFromEnv`, `createSectorsMarketData`, `NewsPage` (T5), dates (T6), reaction/peers (T7), `createFakeLlm`, `createOpenAiLlm` (T9), profile (T10), candidates (T11), guard/confidence (T12), narrate (T13), analogs (T14).
- Produces:
  - `FAKE_UNIVERSE`, `weekdaysBetween(start, end)`, `createFakeMarketData(opts?: { shockDay?: string | null; today?: string }): MarketData`, `fakeNewsPage(today): NewsPage`
  - `FAKE_LLM_RESPONSES`, `llmFromEnv(): LlmClient`
  - `interface PipelineDeps { db: Db; market: MarketData; llm: LlmClient; ledger: CreditLedger; now?: () => Date }`
  - `collectGroups(market, profile, direct): Promise<Record<string, string[]>>`, `collectIndexes(market, profile): Promise<Record<string, string[]>>`
  - `analyzeEvent(eventId: string, deps: PipelineDeps): Promise<Report>`: memakai laporan tersimpan kalau sudah ada. Status event diperbarui per langkah. Kalau error, status `failed` dengan pesan untuk user, lalu error dilempar ulang.
  - `pipelineFromEnv(): Promise<PipelineDeps>` (`SECTORS_MODE=fake` berarti data palsu, selain itu klien Sectors asli)

- [ ] **Step 1: Buat `lib/sectors/fake.ts`** (data sintetis deterministik, **bukan data pasar sungguhan**)

```ts
import { normalizeSymbol, todayWib, type Company, type MarketData, type PricePoint } from '@/lib/domain';
import type { NewsPage } from './endpoints';

/** DATA PALSU: hanya untuk dev UI, E2E dan test. Bukan data pasar sebenarnya. */
export const FAKE_UNIVERSE: Company[] = [
  { symbol: 'BBCA', name: 'PT Bank Central Asia Tbk', subSector: 'Banks', marketCap: 1.0e15 },
  { symbol: 'BBRI', name: 'PT Bank Rakyat Indonesia (Persero) Tbk', subSector: 'Banks', marketCap: 6.0e14 },
  { symbol: 'BMRI', name: 'PT Bank Mandiri (Persero) Tbk', subSector: 'Banks', marketCap: 5.0e14 },
  { symbol: 'BBNI', name: 'PT Bank Negara Indonesia (Persero) Tbk', subSector: 'Banks', marketCap: 1.5e14 },
  { symbol: 'TLKM', name: 'PT Telkom Indonesia (Persero) Tbk', subSector: 'Telecommunication', marketCap: 3.0e14 },
  { symbol: 'ADRO', name: 'PT Alamtri Resources Indonesia Tbk', subSector: 'Oil, Gas & Coal', marketCap: 6.0e13 },
  { symbol: 'PTBA', name: 'PT Bukit Asam Tbk', subSector: 'Oil, Gas & Coal', marketCap: 3.0e13 },
  { symbol: 'ANTM', name: 'PT Aneka Tambang Tbk', subSector: 'Basic Materials', marketCap: 4.0e13 },
];

const FAKE_SHOCKS: Record<string, number> = { BBRI: -0.07, BMRI: -0.05 };
const FAKE_INDEX_MEMBERS: Record<string, string[]> = { IDXBUMN20: ['BBRI', 'BMRI', 'BBNI', 'TLKM', 'PTBA', 'ANTM'] };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const noise = (key: string, amplitude: number) => ((hash(key) % 2001) / 1000 - 1) * amplitude;

export function weekdaysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function series(symbol: string, start: string, end: string, today: string, shockDay: string | null): PricePoint[] {
  let p = 1000 + (hash(symbol) % 9000);
  return weekdaysBetween(start, end < today ? end : today).map((date, i) => {
    if (i > 0) {
      const shock = shockDay !== null && date === shockDay ? (FAKE_SHOCKS[symbol] ?? 0) : 0;
      p = p * (1 + noise(`${symbol}:${date}`, 0.004) + shock);
    }
    return { date, close: Math.round(p * 100) / 100 };
  });
}

export function createFakeMarketData(opts: { shockDay?: string | null; today?: string } = {}): MarketData {
  const today = () => opts.today ?? todayWib();
  const shockDay = opts.shockDay ?? null;
  return {
    today,
    universe: async () => FAKE_UNIVERSE,
    daily: async (symbol, start, end) => series(normalizeSymbol(symbol), start, end, today(), shockDay),
    ihsg: async (start, end) => series('IHSG', start, end, today(), null),
    foreignFlow: async (symbol, start, end) => {
      const s = normalizeSymbol(symbol);
      return weekdaysBetween(start, end < today() ? end : today()).map((date) => ({
        date,
        netForeignInflow: date === shockDay && FAKE_SHOCKS[s] ? -5e11 : Math.round(noise(`ff:${s}:${date}`, 1) * 1e10),
      }));
    },
    affiliates: async () => [],
    groupMembers: async () => [],
    indexMembers: async (code) => FAKE_INDEX_MEMBERS[code.toUpperCase()] ?? [],
    topLosers1d: async () => [],
  };
}

export function fakeNewsPage(today: string): NewsPage {
  return {
    articles: [
      {
        title: '(Contoh) Pemerintah kaji restrukturisasi bank BUMN',
        body: 'Contoh berita sintetis untuk pengembangan. Pemerintah dikabarkan mengkaji penggabungan beberapa bank BUMN.',
        source: 'https://example.com/contoh-berita-1',
        timestamp: `${today}T09:00:00`,
        sector: 'financials',
        sub_sector: ['banks'],
        tags: ['Politics & Regulation'],
        symbols: ['BBRI', 'BMRI'],
      },
      {
        title: '(Contoh) Harga batu bara acuan turun',
        body: 'Contoh berita sintetis untuk pengembangan tentang penurunan harga batu bara acuan.',
        source: 'https://example.com/contoh-berita-2',
        timestamp: `${today}T11:00:00`,
        sector: 'energy',
        sub_sector: ['oil-gas-coal'],
        tags: ['Commodity'],
        symbols: ['PTBA'],
      },
    ],
    hasNext: false,
    nextOffset: null,
  };
}
```

- [ ] **Step 2: Tulis test data palsu `tests/sectors/fake.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { dailyReturns } from '@/lib/market/reaction';
import { createFakeMarketData, weekdaysBetween } from '@/lib/sectors/fake';

describe('fake market data', () => {
  const market = createFakeMarketData({ shockDay: '2026-03-09', today: '2026-03-20' });

  it('only produces weekdays up to today', async () => {
    const ihsg = await market.ihsg('2026-03-01', '2026-03-31');
    expect(ihsg[0].date).toBe('2026-03-02');
    expect(ihsg[ihsg.length - 1].date).toBe('2026-03-20');
    expect(weekdaysBetween('2026-03-07', '2026-03-08')).toEqual([]);
  });

  it('applies the configured shock to BBRI', async () => {
    const r = dailyReturns(await market.daily('BBRI', '2026-02-01', '2026-03-20')).find((x) => x.date === '2026-03-09');
    expect(r!.ret).toBeLessThan(-0.06);
  });

  it('is deterministic', async () => {
    expect(await market.daily('TLKM', '2026-02-01', '2026-03-20')).toEqual(await market.daily('TLKM', '2026-02-01', '2026-03-20'));
  });
});
```

- [ ] **Step 3: Tulis test integrasi yang gagal di `tests/pipeline/analyze.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeLlm } from '@/lib/agent/llm';
import { ProfileExtractionError, type EventProfile } from '@/lib/agent/profile';
import { createDb, type Db } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import { getEvent, insertEvent } from '@/lib/db/repo';
import type { EventInput, LlmClient, MarketData } from '@/lib/domain';
import { DISCLAIMER } from '@/lib/explain/guard';
import type { NarrationInput } from '@/lib/explain/narrate';
import { analyzeEvent } from '@/lib/pipeline/analyze';
import { createFakeMarketData } from '@/lib/sectors/fake';
import { memoryLedger } from '@/lib/sectors/stores';

const PROFILE: EventProfile = {
  summary: 'Pemerintah mengumumkan kebijakan baru untuk bank BUMN.',
  event_type: 'kebijakan',
  themes: ['BUMN'],
  mentioned_companies: [{ name: 'Perusahaan Fiktif', symbol: 'ZZZZ' }],
  sub_sectors: ['Banks'],
  index_hints: ['IDXBUMN20'],
  group_names: [],
  hypotheses: [{ sub_sector: 'Banks', direction: 'negatif', reason: 'Uji.' }],
};

function fakeLlm(): LlmClient {
  return createFakeLlm({
    event_profile: PROFILE,
    narrative: (user: string) => {
      const input = JSON.parse(user) as NarrationInput;
      return {
        headline: 'Saham bank BUMN tertekan',
        chain: ['Kebijakan diumumkan.', 'Saham bank BUMN bereaksi.'],
        explanations: input.findings.map((f) => ({ symbol: f.symbol, text: `Teks ${f.symbol}` })),
      };
    },
  });
}

const baseEvent: EventInput = {
  source: 'manual',
  url: null,
  title: 'Kebijakan bank BUMN',
  body: 'Isi berita uji. '.repeat(30),
  publishedAt: '2026-03-07T09:00:00',
  symbols: ['BBRI'],
  tags: [],
  subSectors: [],
};

let db: Db;
let market: MarketData;
beforeEach(async () => {
  db = createDb(':memory:');
  await migrate(db);
  market = createFakeMarketData({ shockDay: '2026-03-09', today: '2026-03-20' });
});

describe('analyzeEvent', () => {
  it('produces a retrospective report with evidence and saves it', async () => {
    const { event } = await insertEvent(db, baseEvent);
    const report = await analyzeEvent(event.id, { db, market, llm: fakeLlm(), ledger: memoryLedger() });

    expect(report.mode).toBe('retrospective');
    expect(report.market?.t0).toBe('2026-03-09');
    expect(report.market?.marketWide).toBe(false);
    const symbols = report.findings.map((f) => f.candidate.symbol);
    expect(symbols).not.toContain('ZZZZ');
    const bbri = report.findings.find((f) => f.candidate.symbol === 'BBRI')!;
    expect(bbri.candidate.linkType).toBe('direct');
    expect(bbri.reaction?.significant).toBe(true);
    expect(bbri.confidence).toBe('tinggi');
    expect(bbri.netForeignInflow).toBeLessThan(0);
    expect(bbri.explanation).toBe('Teks BBRI');
    const bmri = report.findings.find((f) => f.candidate.symbol === 'BMRI')!;
    expect(bmri.candidate.linkType).toBe('index');
    expect(bmri.confidence).toBe('sedang');
    expect(report.subSectorSummary.find((s) => s.subSector === 'Banks')).toBeDefined();
    expect(report.disclaimer).toBe(DISCLAIMER);
    expect((await getEvent(db, event.id))?.status).toBe('done');
  });

  it('returns the stored report without touching market data again', async () => {
    const { event } = await insertEvent(db, baseEvent);
    const deps = { db, market, llm: fakeLlm(), ledger: memoryLedger() };
    const first = await analyzeEvent(event.id, deps);
    const spy = vi.spyOn(market, 'universe');
    expect(await analyzeEvent(event.id, deps)).toEqual(first);
    expect(spy).not.toHaveBeenCalled();
  });

  it('produces a prospective hypothesis with analogs for a future event', async () => {
    const deps = { db, market, llm: fakeLlm(), ledger: memoryLedger() };
    const past = await insertEvent(db, baseEvent);
    await analyzeEvent(past.event.id, deps);
    const future = await insertEvent(db, { ...baseEvent, publishedAt: '2026-03-25T09:00:00' });
    const report = await analyzeEvent(future.event.id, deps);

    expect(report.mode).toBe('prospective');
    expect(report.market).toBeNull();
    expect(report.headline.startsWith('HIPOTESIS')).toBe(true);
    expect(report.findings.every((f) => f.reaction === null && f.confidence !== 'tinggi')).toBe(true);
    expect(report.analogs).toEqual([expect.objectContaining({ subSector: 'Banks', eventCount: 1 })]);
  });

  it('marks the event failed with a user message when extraction fails', async () => {
    const { event } = await insertEvent(db, baseEvent);
    const llm = createFakeLlm({ event_profile: { broken: true } });
    await expect(analyzeEvent(event.id, { db, market, llm, ledger: memoryLedger() })).rejects.toBeInstanceOf(ProfileExtractionError);
    const stored = await getEvent(db, event.id);
    expect(stored?.status).toBe('failed');
    expect(stored?.statusMessage).toContain('Gagal memahami berita');
  });
});
```

- [ ] **Step 4: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/sectors/fake.test.ts tests/pipeline/analyze.test.ts`
Expected: test fake PASS, test pipeline FAIL ("Cannot find module '@/lib/pipeline/analyze'").

- [ ] **Step 5: Buat `lib/pipeline/analyze.ts`**

```ts
import { buildCandidates, directSymbols, MAX_GROUPS, uniqueSubSectors } from '@/lib/agent/candidates';
import { extractEventProfile, ProfileExtractionError, type EventProfile } from '@/lib/agent/profile';
import type { Db } from '@/lib/db/client';
import { getEvent, getReport, listRetrospectiveReports, saveReport, setEventStatus } from '@/lib/db/repo';
import type { Candidate, LlmClient, MarketData, Mode, Mover, PricePoint, Report, StockFinding } from '@/lib/domain';
import { scoreProspective, scoreRetrospective } from '@/lib/explain/confidence';
import { DISCLAIMER } from '@/lib/explain/guard';
import { narrate, type NarrationInput } from '@/lib/explain/narrate';
import { findAnalogs } from '@/lib/history/analogs';
import { eventCalendarDate, firstTradingDayOnOrAfter, priceWindow } from '@/lib/market/dates';
import { summarizeSubSectors } from '@/lib/market/peers';
import { isMarketWide, marketReturnOn, measureReaction, sumFlowBetween } from '@/lib/market/reaction';
import { CreditBudgetError } from '@/lib/sectors/budget';
import { FixtureMissingError, SectorsHttpError } from '@/lib/sectors/client';
import type { CreditLedger } from '@/lib/sectors/stores';

export interface PipelineDeps {
  db: Db;
  market: MarketData;
  llm: LlmClient;
  ledger: CreditLedger;
  now?: () => Date;
}

export const UNEXPLAINED_THRESHOLD = -0.05;
const PROSPECTIVE_NOTE = 'Belum ada hari bursa setelah event, jadi ini hipotesis.';

export async function collectGroups(market: MarketData, profile: EventProfile, direct: string[]): Promise<Record<string, string[]>> {
  const names: string[] = [];
  for (const g of profile.group_names) if (!names.includes(g)) names.push(g);
  for (const s of direct.slice(0, 2)) {
    for (const g of await market.affiliates(s)) if (!names.includes(g)) names.push(g);
  }
  const out: Record<string, string[]> = {};
  for (const g of names.slice(0, MAX_GROUPS)) out[g] = await market.groupMembers(g);
  return out;
}

export async function collectIndexes(market: MarketData, profile: EventProfile): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const code of [...new Set(profile.index_hints)]) out[code] = await market.indexMembers(code);
  return out;
}

async function measureCandidate(
  market: MarketData,
  c: Candidate,
  ihsg: PricePoint[],
  eventDay: string,
  win: { start: string; end: string },
  marketWide: boolean,
): Promise<StockFinding> {
  const empty = { candidate: c, reaction: null, netForeignInflow: null, confidence: 'rendah' as const, explanation: '' };
  let prices: PricePoint[];
  try {
    prices = await market.daily(c.symbol, win.start, win.end);
  } catch (err) {
    if (err instanceof SectorsHttpError) return { ...empty, dataNote: 'Data tidak tersedia dari Sectors.' };
    throw err;
  }
  const reaction = measureReaction(prices, ihsg, eventDay);
  if (!reaction) return { ...empty, dataNote: 'Data harga tidak cukup untuk mengukur reaksi.' };
  let netForeignInflow: number | null = null;
  try {
    netForeignInflow = sumFlowBetween(await market.foreignFlow(c.symbol, win.start, win.end), reaction.t0, reaction.tEnd);
  } catch (err) {
    if (!(err instanceof SectorsHttpError)) throw err;
  }
  return {
    candidate: c,
    reaction,
    netForeignInflow,
    confidence: scoreRetrospective(c, reaction, marketWide),
    explanation: '',
    dataNote: null,
  };
}

function userMessage(err: unknown): string {
  if (err instanceof ProfileExtractionError) return 'Gagal memahami berita. Coba tempel teksnya atau ringkas beritanya.';
  if (err instanceof CreditBudgetError) return 'Kuota kredit Sectors hampir habis, jadi hanya data cache yang bisa dipakai.';
  if (err instanceof FixtureMissingError) return 'Data contoh (fixture) untuk event ini belum direkam.';
  return 'Terjadi kesalahan saat menganalisis event.';
}

export async function analyzeEvent(eventId: string, deps: PipelineDeps): Promise<Report> {
  const { db, market, llm, ledger } = deps;
  const now = deps.now ?? (() => new Date());
  const existing = await getReport(db, eventId);
  if (existing) return existing;
  const event = await getEvent(db, eventId);
  if (!event) throw new Error(`Event ${eventId} not found`);
  const creditsBefore = await ledger.total();

  try {
    await setEventStatus(db, eventId, 'analyzing', 'Memahami berita…');
    const universe = await market.universe();
    const profile = await extractEventProfile(llm, event, uniqueSubSectors(universe));

    await setEventStatus(db, eventId, 'analyzing', 'Mencari saham terkait…');
    const direct = directSymbols(profile, event.symbols, universe);
    const groupMembers = await collectGroups(market, profile, direct);
    const indexMembers = await collectIndexes(market, profile);
    const { evidence, other } = buildCandidates({ profile, sourceSymbols: event.symbols, universe, groupMembers, indexMembers });

    await setEventStatus(db, eventId, 'analyzing', 'Mengecek reaksi harga…');
    const eventDay = eventCalendarDate(event.publishedAt);
    const win = priceWindow(eventDay, market.today());
    const ihsg = await market.ihsg(win.start, win.end);
    const tradingDays = ihsg.map((p) => p.date);
    const t0 = firstTradingDayOnOrAfter(tradingDays, eventDay);
    const mode: Mode = t0 ? 'retrospective' : 'prospective';
    const analogs = findAnalogs(await listRetrospectiveReports(db), profile.event_type, profile.sub_sectors, eventId);

    let marketInfo: Report['market'] = null;
    let findings: StockFinding[];
    let unexplainedMovers: Mover[] = [];
    if (t0) {
      const ihsgReturn = marketReturnOn(ihsg, t0) ?? 0;
      const marketWide = isMarketWide(ihsgReturn);
      marketInfo = { t0, ihsgReturn, marketWide };
      findings = [];
      for (const c of evidence) findings.push(await measureCandidate(market, c, ihsg, eventDay, win, marketWide));
      if (t0 === tradingDays[tradingDays.length - 1]) {
        const known = new Set([...evidence, ...other].map((c) => c.symbol));
        unexplainedMovers = (await market.topLosers1d()).filter((m) => m.priceChange <= UNEXPLAINED_THRESHOLD && !known.has(m.symbol));
      }
    } else {
      const analogCount = (sub: string | null) =>
        analogs.find((a) => sub !== null && a.subSector.toLowerCase() === sub.toLowerCase())?.eventCount ?? 0;
      findings = evidence.map((c) => ({
        candidate: c,
        reaction: null,
        netForeignInflow: null,
        confidence: scoreProspective(analogCount(c.subSector)),
        explanation: '',
        dataNote: PROSPECTIVE_NOTE,
      }));
    }

    await setEventStatus(db, eventId, 'analyzing', 'Menyusun penjelasan…');
    const narrationInput: NarrationInput = {
      mode,
      title: event.title,
      summary: profile.summary,
      ihsgReturn: marketInfo?.ihsgReturn ?? null,
      marketWide: marketInfo?.marketWide ?? false,
      findings: findings.map((f) => ({
        symbol: f.candidate.symbol,
        name: f.candidate.name,
        linkType: f.candidate.linkType,
        reason: f.candidate.reason,
        car: f.reaction?.car ?? null,
        significant: f.reaction?.significant ?? null,
        netForeignInflow: f.netForeignInflow,
        confidence: f.confidence,
      })),
      analogs,
    };
    const narrative = await narrate(llm, narrationInput);
    const explanationFor = new Map(narrative.explanations.map((e) => [e.symbol, e.text]));
    const finalFindings = findings.map((f) => ({ ...f, explanation: explanationFor.get(f.candidate.symbol) ?? '' }));

    const report: Report = {
      eventId,
      mode,
      eventType: profile.event_type,
      headline: narrative.headline,
      chain: narrative.chain,
      market: marketInfo,
      findings: finalFindings,
      subSectorSummary: summarizeSubSectors(finalFindings),
      otherLinks: other,
      unexplainedMovers,
      analogs,
      creditsUsed: (await ledger.total()) - creditsBefore,
      disclaimer: DISCLAIMER,
      createdAt: now().toISOString(),
    };
    await saveReport(db, report);
    await setEventStatus(db, eventId, 'done', null);
    return report;
  } catch (err) {
    await setEventStatus(db, eventId, 'failed', userMessage(err));
    throw err;
  }
}
```

- [ ] **Step 6: Buat `lib/agent/from-env.ts`**

```ts
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
```

- [ ] **Step 7: Buat `lib/pipeline/from-env.ts`**

```ts
import { llmFromEnv } from '@/lib/agent/from-env';
import { getDb } from '@/lib/db/client';
import { createFakeMarketData } from '@/lib/sectors/fake';
import { sectorsFromEnv } from '@/lib/sectors/from-env';
import { createSectorsMarketData } from '@/lib/sectors/market-data';
import { dbLedger } from '@/lib/sectors/stores';
import type { PipelineDeps } from './analyze';

export async function pipelineFromEnv(): Promise<PipelineDeps> {
  const db = await getDb();
  const market =
    process.env.SECTORS_MODE === 'fake'
      ? createFakeMarketData({ shockDay: process.env.FAKE_SHOCK_DAY || null })
      : createSectorsMarketData(sectorsFromEnv(db));
  return { db, market, llm: llmFromEnv(), ledger: dbLedger(db) };
}
```

- [ ] **Step 8: Jalankan test dan pastikan lolos**

Run: `pnpm test && pnpm typecheck`
Expected: semua PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/sectors/fake.ts lib/agent/from-env.ts lib/pipeline tests/sectors/fake.test.ts tests/pipeline
git commit -m "feat(pipeline): end-to-end analyzeEvent with fake market data and env wiring"
```

---

### Task 17: Penerima berita otomatis (polling) dan endpoint cron

**Files:**
- Create: `lib/events/poll.ts`, `app/api/cron/poll/route.ts`, `scripts/poll.ts`, `tests/events/poll.test.ts`
- Modify: `lib/pipeline/from-env.ts` (tambah `pollFromEnv`)

**Interfaces:**
- Consumes: `insertEvent`, `kvGet`, `kvSet` (T2), `budgetState`, `CreditLedger`, `dbLedger` (T3), `SectorsClient` (T4), `fetchNewsPage`, `NewsPage`, `sectorsFromEnv`, `creditBudget` (T5), `addDays` (T6), `newsToEvent` (T15), `fakeNewsPage` (T16), `getDb`, `todayWib`.
- Produces:
  - `POLL_KV_KEY = 'news:last_poll_date'`, `MAX_POLL_PAGES = 3`
  - `interface NewsSource { page(start: string, offset: number): Promise<NewsPage> }`, `sectorsNewsSource(c)`, `fakeNewsSource(today)`
  - `interface PollResult { inserted: number; skipped: 'budget' | null; start: string }`
  - `pollNews(deps: { db; source; ledger; budget; today }): Promise<PollResult>`. Tidak berjalan kalau budget ≥ 80%. Mulai dari tanggal polling terakhir (default: today − 2). Maksimal 3 halaman. Dedup berdasarkan URL.
  - `pollFromEnv(): Promise<PollResult>`
  - `GET /api/cron/poll` dengan header `Authorization: Bearer $CRON_SECRET`

- [ ] **Step 1: Tulis test yang gagal di `tests/events/poll.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '@/lib/db/client';
import { migrate } from '@/lib/db/migrate';
import { kvGet, listEvents } from '@/lib/db/repo';
import { MAX_POLL_PAGES, POLL_KV_KEY, pollNews, type NewsSource } from '@/lib/events/poll';
import type { NewsPage } from '@/lib/sectors/endpoints';
import { memoryLedger } from '@/lib/sectors/stores';

const TODAY = '2026-09-22';

function article(n: number) {
  return { title: `Berita ${n}`, body: 'Isi', source: `https://example.com/n${n}`, timestamp: '2026-09-22T09:00:00', symbols: [], tags: [], sub_sector: [] };
}

function pagedSource(pages: NewsPage[]) {
  return { page: vi.fn(async (_start: string, offset: number) => pages[offset / 30] ?? { articles: [], hasNext: false, nextOffset: null }) } satisfies NewsSource;
}

let db: Db;
beforeEach(async () => {
  db = createDb(':memory:');
  await migrate(db);
});

describe('pollNews', () => {
  it('inserts new articles, dedupes on re-poll and remembers the poll date', async () => {
    const source = pagedSource([{ articles: [article(1), article(2)], hasNext: false, nextOffset: null }]);
    const first = await pollNews({ db, source, ledger: memoryLedger(), budget: 1000, today: TODAY });
    expect(first).toEqual({ inserted: 2, skipped: null, start: '2026-09-20' });
    expect(await kvGet(db, POLL_KV_KEY)).toBe(TODAY);

    const second = await pollNews({ db, source, ledger: memoryLedger(), budget: 1000, today: TODAY });
    expect(second).toEqual({ inserted: 0, skipped: null, start: TODAY });
    expect(await listEvents(db)).toHaveLength(2);
  });

  it('follows pagination but stops at MAX_POLL_PAGES', async () => {
    const pages = Array.from({ length: 5 }, (_, i) => ({ articles: [article(i)], hasNext: true, nextOffset: (i + 1) * 30 }));
    const source = pagedSource(pages);
    const result = await pollNews({ db, source, ledger: memoryLedger(), budget: 1000, today: TODAY });
    expect(source.page).toHaveBeenCalledTimes(MAX_POLL_PAGES);
    expect(result.inserted).toBe(MAX_POLL_PAGES);
  });

  it('skips polling when the credit budget is at 80% or more', async () => {
    const source = pagedSource([]);
    const result = await pollNews({ db, source, ledger: memoryLedger(800), budget: 1000, today: TODAY });
    expect(result.skipped).toBe('budget');
    expect(source.page).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/events/poll.test.ts`
Expected: FAIL, "Cannot find module '@/lib/events/poll'"

- [ ] **Step 3: Buat `lib/events/poll.ts`**

```ts
import type { Db } from '@/lib/db/client';
import { insertEvent, kvGet, kvSet } from '@/lib/db/repo';
import { addDays } from '@/lib/market/dates';
import { budgetState } from '@/lib/sectors/budget';
import type { SectorsClient } from '@/lib/sectors/client';
import { fetchNewsPage, type NewsPage } from '@/lib/sectors/endpoints';
import { fakeNewsPage } from '@/lib/sectors/fake';
import type { CreditLedger } from '@/lib/sectors/stores';
import { newsToEvent } from './news';

export const POLL_KV_KEY = 'news:last_poll_date';
export const MAX_POLL_PAGES = 3;
const DEFAULT_LOOKBACK_DAYS = 2;

export interface NewsSource {
  page(start: string, offset: number): Promise<NewsPage>;
}

export function sectorsNewsSource(c: SectorsClient): NewsSource {
  return { page: (start, offset) => fetchNewsPage(c, { start, offset }) };
}

export function fakeNewsSource(today: string): NewsSource {
  return { page: async () => fakeNewsPage(today) };
}

export interface PollResult {
  inserted: number;
  skipped: 'budget' | null;
  start: string;
}

export async function pollNews(deps: {
  db: Db;
  source: NewsSource;
  ledger: CreditLedger;
  budget: number;
  today: string;
}): Promise<PollResult> {
  const start = (await kvGet(deps.db, POLL_KV_KEY)) ?? addDays(deps.today, -DEFAULT_LOOKBACK_DAYS);
  if (budgetState(await deps.ledger.total(), deps.budget) !== 'ok') return { inserted: 0, skipped: 'budget', start };

  let inserted = 0;
  let offset = 0;
  for (let page = 0; page < MAX_POLL_PAGES; page++) {
    const res = await deps.source.page(start, offset);
    for (const article of res.articles) {
      if ((await insertEvent(deps.db, newsToEvent(article))).created) inserted++;
    }
    if (!res.hasNext || res.nextOffset === null) break;
    offset = res.nextOffset;
  }
  await kvSet(deps.db, POLL_KV_KEY, deps.today);
  return { inserted, skipped: null, start };
}
```

- [ ] **Step 4: Tambahkan `pollFromEnv` di akhir `lib/pipeline/from-env.ts`**

Tambahkan import berikut di atas file:
```ts
import { todayWib } from '@/lib/domain';
import { fakeNewsSource, pollNews, sectorsNewsSource, type PollResult } from '@/lib/events/poll';
import { creditBudget } from '@/lib/sectors/from-env';
```
lalu tambahkan fungsi berikut di akhir file:
```ts
export async function pollFromEnv(): Promise<PollResult> {
  const db = await getDb();
  const today = todayWib();
  const source = process.env.SECTORS_MODE === 'fake' ? fakeNewsSource(today) : sectorsNewsSource(sectorsFromEnv(db));
  return pollNews({ db, source, ledger: dbLedger(db), budget: creditBudget(), today });
}
```
(`creditBudget` dan `sectorsFromEnv` sama-sama berasal dari `@/lib/sectors/from-env`. Gabungkan keduanya dalam satu import.)

- [ ] **Step 5: Buat `app/api/cron/poll/route.ts`**

```ts
import { pollFromEnv } from '@/lib/pipeline/from-env';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  return Response.json(await pollFromEnv());
}
```

- [ ] **Step 6: Buat `scripts/poll.ts`** (kalau `scripts/env.ts` dari Task 8 belum ada, buat juga dengan isi yang sama seperti Task 8 Step 1)

```ts
import './env';
import { pollFromEnv } from '@/lib/pipeline/from-env';

pollFromEnv()
  .then((result) => {
    console.log(result.skipped ? `Polling dilewati (${result.skipped}).` : `Berita baru: ${result.inserted} (sejak ${result.start}).`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 7: Jalankan test dan pastikan lolos**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Uji manual polling dengan data palsu**

Run: `SECTORS_MODE=fake DATABASE_URL=file:dev.db pnpm poll` (PowerShell: `$env:SECTORS_MODE='fake'; $env:DATABASE_URL='file:dev.db'; pnpm poll`)
Expected: "Berita baru: 2 (sejak ...)". Kalau dijalankan lagi: "Berita baru: 0".

- [ ] **Step 9: Commit**

```bash
git add lib/events/poll.ts lib/pipeline/from-env.ts app/api/cron scripts/poll.ts tests/events/poll.test.ts
git commit -m "feat(events): automatic news receiver with budget-aware polling and cron endpoint"
```

---

### Task 18: Route API: analisis, daftar event, detail event, kredit

**Files:**
- Create: `app/api/analyze/route.ts`, `app/api/events/route.ts`, `app/api/events/[id]/route.ts`, `app/api/credits/route.ts`

**Interfaces:**
- Consumes: `pipelineFromEnv`, `analyzeEvent` (T16), `buildManualEvent`, `InputError`, `ArticleFetchError` (T15), repo (T2), `budgetState`, `dbLedger` (T3), `creditBudget` (T5), `todayWib`.
- Produces (kontrak HTTP yang dipakai UI di Task 19):
  - `POST /api/analyze` dengan body `{ url?: string; text?: string; title?: string; date?: 'YYYY-MM-DD'; eventId?: string }`
    - `202 { eventId }`: analisis berjalan di background (`after()`)
    - `400 { error }`: body tidak valid
    - `422 { error, needText: true }`: link gagal dibaca atau teks terlalu pendek
  - `GET /api/events` menghasilkan `200 { events: StoredEvent[] }`
  - `GET /api/events/:id` menghasilkan `200 { event: StoredEvent; report: Report | null }` atau `404`
  - `GET /api/credits` menghasilkan `200 { used: number; budget: number; state: 'ok' | 'warn' | 'blocked' }`

Route handler dibuat tipis. Semua logikanya sudah dites di Task 15–16 dan diverifikasi lewat E2E di Task 20. `after()` dari `next/server` tidak bisa dipanggil di luar request Next, jadi tidak ada unit test untuk route.

- [ ] **Step 1: Buat `app/api/analyze/route.ts`**

```ts
import { after } from 'next/server';
import { z } from 'zod';
import { insertEvent } from '@/lib/db/repo';
import { todayWib } from '@/lib/domain';
import { ArticleFetchError } from '@/lib/events/article';
import { buildManualEvent, InputError } from '@/lib/events/manual';
import { analyzeEvent } from '@/lib/pipeline/analyze';
import { pipelineFromEnv } from '@/lib/pipeline/from-env';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  url: z.string().url().optional(),
  text: z.string().optional(),
  title: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  eventId: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Input tidak valid.' }, { status: 400 });

  const deps = await pipelineFromEnv();
  let eventId = parsed.data.eventId;
  if (!eventId) {
    try {
      const input = await buildManualEvent(parsed.data, todayWib());
      eventId = (await insertEvent(deps.db, input)).event.id;
    } catch (err) {
      if (err instanceof InputError || err instanceof ArticleFetchError) {
        return Response.json({ error: err.message, needText: true }, { status: 422 });
      }
      throw err;
    }
  }

  const id = eventId;
  after(async () => {
    try {
      await analyzeEvent(id, deps);
    } catch (err) {
      console.error('analyzeEvent failed', id, err);
    }
  });
  return Response.json({ eventId: id }, { status: 202 });
}
```

- [ ] **Step 2: Buat `app/api/events/route.ts`**

```ts
import { getDb } from '@/lib/db/client';
import { listEvents } from '@/lib/db/repo';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({ events: await listEvents(await getDb(), 50) });
}
```

- [ ] **Step 3: Buat `app/api/events/[id]/route.ts`**

```ts
import { getDb } from '@/lib/db/client';
import { getEvent, getReport } from '@/lib/db/repo';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const db = await getDb();
  const event = await getEvent(db, id);
  if (!event) return Response.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
  return Response.json({ event, report: await getReport(db, id) });
}
```

- [ ] **Step 4: Buat `app/api/credits/route.ts`**

```ts
import { getDb } from '@/lib/db/client';
import { budgetState } from '@/lib/sectors/budget';
import { creditBudget } from '@/lib/sectors/from-env';
import { dbLedger } from '@/lib/sectors/stores';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const used = await dbLedger(await getDb()).total();
  const budget = creditBudget();
  return Response.json({ used, budget, state: budgetState(used, budget) });
}
```

- [ ] **Step 5: Verifikasi build dan uji manual**

Run: `pnpm typecheck && pnpm build`
Expected: build sukses.

Lalu jalankan `SECTORS_MODE=fake LLM_MODE=fake FAKE_SHOCK_DAY=2026-03-02 DATABASE_URL=file:dev.db pnpm dev` dan di terminal lain:
```bash
curl -s -X POST localhost:3000/api/analyze -H "Content-Type: application/json" -d "{\"text\":\"Presiden menyampaikan pidato tentang rencana pengelolaan BUMN melalui badan investasi baru dan dampaknya ke bank.\",\"date\":\"2026-03-02\"}"
```
Expected: `{"eventId":"..."}`. Beberapa detik kemudian, `curl -s localhost:3000/api/events/<eventId>` menampilkan `report.mode` = `"retrospective"`.

- [ ] **Step 6: Commit**

```bash
git add app/api
git commit -m "feat(api): analyze, events and credits routes"
```

---

### Task 19: UI: beranda (tempel berita dan feed) dan halaman laporan

**Files:**
- Create: `lib/ui/labels.ts`, `tests/ui/labels.test.ts`, `components/Disclaimer.tsx`, `components/CreditBanner.tsx`, `components/AnalyzeForm.tsx`, `components/AnalyzeFeedButton.tsx`, `components/Feed.tsx`, `components/ReportView.tsx`, `app/events/[id]/page.tsx`
- Modify: `app/layout.tsx`, `app/page.tsx` (ganti seluruh isinya)

**Interfaces:**
- Consumes: kontrak HTTP dari Task 18, `Report`, `StoredEvent`, `LinkType`, `Confidence`, `Mode` (T1), `DISCLAIMER`, `findBannedPhrases` (T12), `formatPct`, `formatIdrBillion` (T13), `getDb`, `listEvents` (T2), `budgetState`, `dbLedger` (T3), `creditBudget` (T5).
- Produces:
  - `LINK_TYPE_LABEL`, `CONFIDENCE_LABEL`, `modeLabel(mode)`
  - Label form yang dipakai E2E (Task 20): **"Link berita"**, **"Atau tempel teks berita"**, **"Tanggal event (opsional)"**, dan tombol **"Analisis berita"**

Orang 4 bisa mulai mengerjakan komponen sebelum Task 18 selesai, dengan merender `ReportView` memakai `makeReport()` dari `tests/helpers/factories.ts`.

- [ ] **Step 1: Tulis test yang gagal di `tests/ui/labels.test.ts`**

```ts
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
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/ui/labels.test.ts`
Expected: FAIL, "Cannot find module '@/lib/ui/labels'"

- [ ] **Step 3: Buat `lib/ui/labels.ts`**

```ts
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
```

- [ ] **Step 4: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/ui/labels.test.ts`
Expected: PASS.

- [ ] **Step 5: Ganti isi `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Correlation Explainer',
  description: 'Dari berita ke saham IDX yang terkait, lengkap dengan bukti data Sectors. Bukan saran investasi.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Buat `components/Disclaimer.tsx`**

```tsx
import { DISCLAIMER } from '@/lib/explain/guard';

export function Disclaimer() {
  return (
    <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      {DISCLAIMER}
    </p>
  );
}
```

- [ ] **Step 7: Buat `components/CreditBanner.tsx`** (server component)

```tsx
import { getDb } from '@/lib/db/client';
import { budgetState } from '@/lib/sectors/budget';
import { creditBudget } from '@/lib/sectors/from-env';
import { dbLedger } from '@/lib/sectors/stores';

export async function CreditBanner() {
  const used = await dbLedger(await getDb()).total();
  const budget = creditBudget();
  const state = budgetState(used, budget);
  if (state === 'ok') {
    return <p className="text-sm text-gray-500">Kredit Sectors terpakai: {used} / {budget}</p>;
  }
  return (
    <p role="alert" className={`rounded-md p-3 text-sm ${state === 'warn' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'}`}>
      {state === 'warn'
        ? `Kredit Sectors sudah ${used}/${budget} (≥80%). Penerima berita otomatis dihentikan.`
        : `Kredit Sectors sudah ${used}/${budget} (≥90%). Hanya data cache yang dipakai.`}
    </p>
  );
}
```

- [ ] **Step 8: Buat `components/AnalyzeForm.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const MAX_CREDITS_PER_ANALYSIS = 19;

export function AnalyzeForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url || undefined, text: text || undefined, date: date || undefined }),
    });
    const body = (await res.json()) as { eventId?: string; error?: string };
    setBusy(false);
    if (res.status === 202 && body.eventId) {
      router.push(`/events/${body.eventId}`);
      return;
    }
    setError(body.error ?? 'Terjadi kesalahan.');
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">Cek berita atau event</h2>
      <label className="block text-sm font-medium">
        Link berita
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Atau tempel teks berita
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Tanggal event (opsional)
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 rounded border px-3 py-2" />
      </label>
      <p className="text-xs text-gray-500">
        Analisis memakai maksimal ~{MAX_CREDITS_PER_ANALYSIS} kredit Sectors (lebih sedikit jika data sudah di-cache).
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        {busy ? 'Memproses…' : 'Analisis berita'}
      </button>
    </form>
  );
}
```

- [ ] **Step 9: Buat `components/AnalyzeFeedButton.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AnalyzeFeedButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    });
    setBusy(false);
    if (res.status === 202) router.push(`/events/${eventId}`);
  }

  return (
    <button type="button" onClick={run} disabled={busy} className="shrink-0 rounded border px-3 py-1 text-sm disabled:opacity-50">
      {busy ? 'Memproses…' : 'Analisis'}
    </button>
  );
}
```

- [ ] **Step 10: Buat `components/Feed.tsx`**

```tsx
import Link from 'next/link';
import type { StoredEvent } from '@/lib/domain';
import { AnalyzeFeedButton } from './AnalyzeFeedButton';

export function Feed({ events }: { events: StoredEvent[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Berita terbaru</h2>
      {events.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada berita. Penerima otomatis berjalan setiap hari bursa.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {events.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-4 p-3">
              <div className="min-w-0">
                <p className="font-medium">{e.title}</p>
                <p className="text-xs text-gray-500">
                  {e.publishedAt.slice(0, 16).replace('T', ' ')} · {e.source === 'feed' ? 'Sectors' : 'Manual'}
                  {e.symbols.length > 0 ? ` · ${e.symbols.join(', ')}` : ''}
                </p>
                {e.tags.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {e.tags.map((t) => (
                      <span key={t} className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                        {t}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              {e.status === 'done' ? (
                <Link href={`/events/${e.id}`} className="shrink-0 text-sm text-blue-700 underline">
                  Lihat laporan
                </Link>
              ) : (
                <AnalyzeFeedButton eventId={e.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 11: Buat `components/ReportView.tsx`**

```tsx
'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Report, StoredEvent } from '@/lib/domain';
import { formatIdrBillion, formatPct } from '@/lib/format';
import { CONFIDENCE_LABEL, LINK_TYPE_LABEL, modeLabel } from '@/lib/ui/labels';
import { Disclaimer } from './Disclaimer';

export function ReportView({ event, report }: { event: StoredEvent; report: Report }) {
  const chartData = report.findings
    .filter((f) => f.reaction !== null)
    .map((f) => ({ symbol: f.candidate.symbol, car: Number(((f.reaction?.car ?? 0) * 100).toFixed(2)) }));

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
            report.mode === 'prospective' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
          }`}
        >
          {modeLabel(report.mode)}
        </span>
        <h1 className="text-2xl font-bold">{report.headline}</h1>
        <p className="text-sm text-gray-600">
          Berita:{' '}
          {event.url ? (
            <a href={event.url} target="_blank" rel="noreferrer" className="underline">
              {event.title}
            </a>
          ) : (
            event.title
          )}
        </p>
      </header>

      <Disclaimer />

      {report.market && (
        <section className="rounded-lg border p-4">
          <h2 className="font-semibold">Kondisi pasar</h2>
          <p>
            Hari bursa pertama setelah event: {report.market.t0}. IHSG {formatPct(report.market.ihsgReturn)} pada hari itu.
          </p>
          {report.market.marketWide && (
            <p className="text-amber-700">Pasar bergerak besar secara luas, jadi keterkaitan per saham lebih lemah.</p>
          )}
        </section>
      )}

      <section>
        <h2 className="font-semibold">Rantai sebab-akibat</h2>
        <ol className="list-decimal space-y-1 pl-5">
          {report.chain.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>

      {chartData.length > 0 && (
        <section>
          <h2 className="font-semibold">Abnormal return kumulatif dibanding IHSG (%)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="symbol" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="car">
                  {chartData.map((d) => (
                    <Cell key={d.symbol} fill={d.car < 0 ? '#dc2626' : '#16a34a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Saham terkait</h2>
        {report.findings.map((f) => (
          <div key={f.candidate.symbol} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                {f.candidate.symbol} · {f.candidate.name}
              </p>
              <span className="text-xs">{CONFIDENCE_LABEL[f.confidence]}</span>
            </div>
            <p className="text-xs text-gray-500">
              {LINK_TYPE_LABEL[f.candidate.linkType]}: {f.candidate.reason}
            </p>
            {f.reaction && (
              <p className="mt-1 text-sm">
                CAR {formatPct(f.reaction.car)} ({f.reaction.t0} s/d {f.reaction.tEnd}, z = {f.reaction.zScore.toFixed(1)}
                {f.reaction.significant ? ', signifikan' : ''})
                {f.netForeignInflow !== null && f.netForeignInflow !== 0
                  ? ` · ${f.netForeignInflow < 0 ? 'net jual asing' : 'net beli asing'} ${formatIdrBillion(f.netForeignInflow)}`
                  : ''}
              </p>
            )}
            <p className="mt-2">{f.explanation}</p>
            {f.dataNote && <p className="mt-1 text-xs text-gray-500">{f.dataNote}</p>}
          </div>
        ))}
      </section>

      {report.subSectorSummary.length > 0 && (
        <section>
          <h2 className="font-semibold">Ringkasan per subsektor</h2>
          <ul className="list-disc pl-5">
            {report.subSectorSummary.map((s) => (
              <li key={s.subSector}>
                {s.subSector}: rata-rata {formatPct(s.avgCar)} dibanding IHSG ({s.count} saham)
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-semibold">Pola historis</h2>
        {report.analogs.length > 0 ? (
          <ul className="list-disc pl-5">
            {report.analogs.map((a) => (
              <li key={a.subSector}>
                {a.subSector}: {a.eventCount} event serupa, rata-rata {formatPct(a.avgCar)} dibanding IHSG
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Belum ada preseden serupa di pustaka kami.</p>
        )}
      </section>

      {report.unexplainedMovers.length > 0 && (
        <section>
          <h2 className="font-semibold">Saham yang turun tajam tetapi belum terjelaskan</h2>
          <ul className="list-disc pl-5">
            {report.unexplainedMovers.map((m) => (
              <li key={m.symbol}>
                {m.symbol} · {m.name}: {formatPct(m.priceChange)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.otherLinks.length > 0 && (
        <section>
          <h2 className="font-semibold">Kaitan lain (tanpa bukti harga)</h2>
          <ul className="list-disc pl-5">
            {report.otherLinks.map((c) => (
              <li key={c.symbol}>
                {c.symbol} · {c.name} ({c.reason})
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="text-xs text-gray-500">
        Kredit Sectors terpakai untuk laporan ini: {report.creditsUsed}. Dibuat {report.createdAt.slice(0, 16).replace('T', ' ')} UTC.
      </footer>
    </article>
  );
}
```

- [ ] **Step 12: Ganti isi `app/page.tsx`**

```tsx
import { AnalyzeForm } from '@/components/AnalyzeForm';
import { CreditBanner } from '@/components/CreditBanner';
import { Feed } from '@/components/Feed';
import { getDb } from '@/lib/db/client';
import { listEvents } from '@/lib/db/repo';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const events = await listEvents(await getDb(), 30);
  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Correlation Explainer</h1>
        <p className="text-gray-600">Dari berita ke saham IDX yang terkait, lengkap dengan bukti data Sectors.</p>
      </header>
      <CreditBanner />
      <AnalyzeForm />
      <Feed events={events} />
    </main>
  );
}
```

- [ ] **Step 13: Buat `app/events/[id]/page.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ReportView } from '@/components/ReportView';
import type { Report, StoredEvent } from '@/lib/domain';

interface EventResponse {
  event: StoredEvent;
  report: Report | null;
}

const POLL_MS = 2000;

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<EventResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      const res = await fetch(`/api/events/${id}`, { cache: 'no-store' });
      if (!active) return;
      if (!res.ok) {
        setError('Event tidak ditemukan.');
        return;
      }
      const body = (await res.json()) as EventResponse;
      setData(body);
      if (!body.report && body.event.status !== 'failed') timer = setTimeout(tick, POLL_MS);
    }
    void tick();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  const failed = data?.event.status === 'failed' && !data.report;
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <Link href="/" className="text-sm underline">
        ← Kembali
      </Link>
      {error && <p role="alert">{error}</p>}
      {!error && !data && <p>Memuat…</p>}
      {data && !data.report && !failed && <p aria-live="polite">{data.event.statusMessage ?? 'Menunggu analisis…'}</p>}
      {failed && (
        <p role="alert" className="text-red-700">
          {data?.event.statusMessage ?? 'Analisis gagal.'}
        </p>
      )}
      {data?.report && <ReportView event={data.event} report={data.report} />}
    </main>
  );
}
```

- [ ] **Step 14: Verifikasi**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: semua lolos.

Uji manual: jalankan `SECTORS_MODE=fake LLM_MODE=fake FAKE_SHOCK_DAY=2026-03-02 DATABASE_URL=file:dev.db pnpm dev`, buka http://localhost:3000, tempel teks lebih dari 80 karakter, isi tanggal 2026-03-02, lalu klik "Analisis berita". Laporan retrospektif harus tampil, berisi grafik BBRI/BMRI merah dan disclaimer.

- [ ] **Step 15: Commit**

```bash
git add lib/ui tests/ui components app/layout.tsx app/page.tsx app/events
git commit -m "feat(ui): paste form, news feed, credit banner and report page"
```

---

### Task 20: Test end-to-end (Playwright, mode palsu)

**Files:**
- Create: `playwright.config.ts`, `e2e/analyze.spec.ts`
- Modify: `.github/workflows/ci.yml` (tambah job `e2e`)

**Interfaces:**
- Consumes: UI dan route dari Task 17–19 (label form, `GET /api/cron/poll`).

- [ ] **Step 1: Pasang browser Playwright**

Run: `pnpm exec playwright install chromium`

- [ ] **Step 2: Buat `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:3100' },
  webServer: {
    command: 'node -e "require(\'fs\').rmSync(\'e2e.db\',{force:true})" && pnpm dev --port 3100',
    url: 'http://localhost:3100',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      SECTORS_MODE: 'fake',
      LLM_MODE: 'fake',
      FAKE_SHOCK_DAY: '2026-03-02',
      DATABASE_URL: 'file:e2e.db',
      CRON_SECRET: 'e2e-secret',
    },
  },
});
```

- [ ] **Step 3: Tulis test di `e2e/analyze.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('pasted text produces a retrospective report with evidence and disclaimer', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('Atau tempel teks berita')
    .fill(
      'Presiden menyampaikan pidato tentang rencana pengelolaan BUMN melalui badan investasi baru. Pelaku pasar menanggapi rencana tersebut dengan hati-hati, terutama pada saham bank milik negara.',
    );
  await page.getByLabel('Tanggal event (opsional)').fill('2026-03-02');
  await page.getByRole('button', { name: 'Analisis berita' }).click();

  await expect(page).toHaveURL(/\/events\//);
  await expect(page.getByText('bukan saran investasi')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Retrospektif')).toBeVisible();
  await expect(page.getByText('BBRI · PT Bank Rakyat Indonesia (Persero) Tbk')).toBeVisible();
});

test('automatic receiver adds news to the feed', async ({ page, request }) => {
  const res = await request.get('/api/cron/poll', { headers: { Authorization: 'Bearer e2e-secret' } });
  expect(res.ok()).toBe(true);
  await page.goto('/');
  await expect(page.getByText('(Contoh) Pemerintah kaji restrukturisasi bank BUMN')).toBeVisible();
});

test('cron endpoint rejects requests without the secret', async ({ request }) => {
  expect((await request.get('/api/cron/poll')).status()).toBe(401);
});
```

- [ ] **Step 4: Jalankan E2E**

Run: `pnpm e2e`
Expected: 3 test PASS.

- [ ] **Step 5: Tambah job `e2e` di `.github/workflows/ci.yml`** (di bawah job `test`, dengan indentasi yang sama)

```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm e2e
```

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e .github/workflows/ci.yml
git commit -m "test(e2e): paste-to-report and automatic receiver flows in fake mode"
```

---

### Task 21: Pustaka event historis (seed) dan evaluasi golden set

**Files:**
- Create: `lib/eval/score.ts`, `tests/eval/score.test.ts`, `scripts/seed-history.ts`, `scripts/eval-golden.ts`, `data/golden-set.json`

**Interfaces:**
- Consumes: `insertEvent` (T2), `fetchNewsPage`, `sectorsFromEnv` (T5), `addDays`, `eventCalendarDate` (T6), `extractEventProfile` (T10), `buildCandidates`, `directSymbols`, `uniqueSubSectors` (T11), `newsToEvent`, `manualEvent` (T15), `analyzeEvent`, `collectGroups`, `collectIndexes`, `pipelineFromEnv` (T16), `todayWib`.
- Produces:
  - `interface GoldenCase { title: string; text: string; date: string; expected_sub_sectors: string[]; expected_symbols: string[] }`
  - `precisionRecall(expected: string[], actual: string[]): { precision: number; recall: number }` (tidak peka huruf besar-kecil. Tanpa prediksi: presisi = 1 kalau tidak ada yang diharapkan, selain itu 0. Tanpa ekspektasi: recall = 1), `mean(xs: number[]): number`
  - `pnpm seed:history --tag <slug> --since YYYY-MM-DD --limit 15` untuk membangun laporan retrospektif (pustaka analog)
  - `pnpm eval` untuk mencetak presisi/recall subsektor dan saham

- [ ] **Step 1: Tulis test yang gagal di `tests/eval/score.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { mean, precisionRecall } from '@/lib/eval/score';

describe('precisionRecall', () => {
  it('compares case-insensitively', () => {
    expect(precisionRecall(['BBRI', 'BMRI'], ['bbri', 'TLKM'])).toEqual({ precision: 0.5, recall: 0.5 });
  });
  it('handles empty sides', () => {
    expect(precisionRecall(['BBRI'], [])).toEqual({ precision: 0, recall: 0 });
    expect(precisionRecall([], [])).toEqual({ precision: 1, recall: 1 });
    expect(precisionRecall([], ['BBRI'])).toEqual({ precision: 0, recall: 1 });
  });
});

describe('mean', () => {
  it('averages and returns 0 for empty input', () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `pnpm test tests/eval/score.test.ts`
Expected: FAIL, "Cannot find module '@/lib/eval/score'"

- [ ] **Step 3: Buat `lib/eval/score.ts`**

```ts
export interface GoldenCase {
  title: string;
  text: string;
  date: string;
  expected_sub_sectors: string[];
  expected_symbols: string[];
}

export function precisionRecall(expected: string[], actual: string[]): { precision: number; recall: number } {
  const e = new Set(expected.map((x) => x.toLowerCase()));
  const a = new Set(actual.map((x) => x.toLowerCase()));
  const hits = [...a].filter((x) => e.has(x)).length;
  return {
    precision: a.size > 0 ? hits / a.size : e.size === 0 ? 1 : 0,
    recall: e.size > 0 ? hits / e.size : 1,
  };
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}
```

- [ ] **Step 4: Jalankan test dan pastikan lolos**

Run: `pnpm test tests/eval/score.test.ts`
Expected: PASS.

- [ ] **Step 5: Buat `data/golden-set.json`** berisi `[]`. Tim mengisinya di Step 8.

```json
[]
```

- [ ] **Step 6: Buat `scripts/seed-history.ts`**

```ts
import './env';
import { insertEvent } from '@/lib/db/repo';
import { todayWib } from '@/lib/domain';
import { newsToEvent } from '@/lib/events/news';
import { addDays, eventCalendarDate } from '@/lib/market/dates';
import { analyzeEvent } from '@/lib/pipeline/analyze';
import { pipelineFromEnv } from '@/lib/pipeline/from-env';
import { fetchNewsPage } from '@/lib/sectors/endpoints';
import { sectorsFromEnv } from '@/lib/sectors/from-env';

const MAX_PAGES = 5;
/** Only events old enough for the full post-event window (t0..t0+5 trading days). */
const SETTLE_DAYS = 8;

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : fallback;
  if (value === undefined) throw new Error(`Argumen --${name} wajib diisi`);
  return value;
}

async function main(): Promise<void> {
  if (process.env.SECTORS_MODE !== 'live') throw new Error('Jalankan dengan SECTORS_MODE=live (script ini memakai kredit asli).');
  const tag = arg('tag');
  const since = arg('since');
  const limit = Number(arg('limit', '15'));
  const deps = await pipelineFromEnv();
  const client = sectorsFromEnv(deps.db);
  const cutoff = addDays(todayWib(), -SETTLE_DAYS);
  const before = await deps.ledger.total();

  let offset = 0;
  let done = 0;
  for (let page = 0; page < MAX_PAGES && done < limit; page++) {
    const res = await fetchNewsPage(client, { start: since, offset, tags: tag });
    for (const article of res.articles) {
      if (done >= limit) break;
      if (eventCalendarDate(article.timestamp) > cutoff) continue;
      const { event } = await insertEvent(deps.db, newsToEvent(article));
      try {
        const report = await analyzeEvent(event.id, deps);
        done++;
        console.log(`OK  ${article.title.slice(0, 70)} | ${report.mode} | ${report.findings.length} saham | ${report.creditsUsed} kredit`);
      } catch (err) {
        console.error(`ERR ${article.title.slice(0, 70)} | ${(err as Error).message}`);
      }
    }
    if (!res.hasNext || res.nextOffset === null) break;
    offset = res.nextOffset;
  }
  console.log(`Selesai: ${done} event. Total kredit: ${(await deps.ledger.total()) - before}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 7: Buat `scripts/eval-golden.ts`**

```ts
import './env';
import { readFile } from 'node:fs/promises';
import { buildCandidates, directSymbols, uniqueSubSectors } from '@/lib/agent/candidates';
import { extractEventProfile } from '@/lib/agent/profile';
import { mean, precisionRecall, type GoldenCase } from '@/lib/eval/score';
import { manualEvent } from '@/lib/events/manual';
import { collectGroups, collectIndexes } from '@/lib/pipeline/analyze';
import { pipelineFromEnv } from '@/lib/pipeline/from-env';

async function main(): Promise<void> {
  const cases = JSON.parse(await readFile('data/golden-set.json', 'utf8')) as GoldenCase[];
  if (cases.length === 0) {
    console.log('data/golden-set.json masih kosong. Isi 8–10 event nyata (lihat README bagian "Golden set").');
    return;
  }
  const { market, llm } = await pipelineFromEnv();
  const universe = await market.universe();
  const rows: Array<{ event: string; subP: number; subR: number; symP: number; symR: number }> = [];
  for (const c of cases) {
    const event = manualEvent({ url: null, title: c.title, text: c.text, publishedAt: c.date });
    const profile = await extractEventProfile(llm, event, uniqueSubSectors(universe));
    const direct = directSymbols(profile, [], universe);
    const { evidence, other } = buildCandidates({
      profile,
      sourceSymbols: [],
      universe,
      groupMembers: await collectGroups(market, profile, direct),
      indexMembers: await collectIndexes(market, profile),
    });
    const sub = precisionRecall(c.expected_sub_sectors, profile.sub_sectors);
    const sym = precisionRecall(c.expected_symbols, [...evidence, ...other].map((x) => x.symbol));
    rows.push({ event: c.title.slice(0, 50), subP: sub.precision, subR: sub.recall, symP: sym.precision, symR: sym.recall });
  }
  console.table(rows);
  console.log(
    `Rata-rata subsektor: presisi ${mean(rows.map((r) => r.subP)).toFixed(2)}, recall ${mean(rows.map((r) => r.subR)).toFixed(2)}`,
  );
  console.log(`Rata-rata saham: presisi ${mean(rows.map((r) => r.symP)).toFixed(2)}, recall ${mean(rows.map((r) => r.symR)).toFixed(2)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 8: Isi golden set dengan event nyata (pekerjaan manual tim)**

Kumpulkan 8–10 berita **nyata** (pidato atau kebijakan pemerintah, komoditas, geopolitik) beserta tanggalnya. Untuk setiap berita, tulis subsektor dan saham yang *menurut tim* seharusnya terkait. Nama subsektor harus persis sama dengan yang ada di universe (lihat fixture `v2_companies_*.json`). Formatnya:

```json
[
  {
    "title": "<judul berita asli>",
    "text": "<ringkasan atau isi berita asli, minimal 80 karakter>",
    "date": "YYYY-MM-DD",
    "expected_sub_sectors": ["Banks"],
    "expected_symbols": ["BBRI", "BMRI"]
  }
]
```

- [ ] **Step 9: Jalankan seed histori dan evaluasi (memakai kredit asli)**

1. Uji kecil dulu: `SECTORS_MODE=live pnpm seed:history --tag <slug-politik-dari-Task-8> --since 2026-06-01 --limit 3` lalu catat kredit per event.
2. Kalau biayanya sesuai anggaran (≤ ~10 per event rata-rata), jalankan `--limit 12`. Target total pustaka ±15 event, **maksimal 120 kredit**.
3. `SECTORS_MODE=live LLM_MODE=openai pnpm eval` lalu catat angka presisi/recall untuk video.

Expected: log `OK ...` per event. Tabel evaluasi tercetak.

- [ ] **Step 10: Commit** (hanya kode dan golden set. Database lokal tidak di-commit)

```bash
git add lib/eval tests/eval scripts/seed-history.ts scripts/eval-golden.ts data/golden-set.json
git commit -m "feat(history): seed script for analog library and golden-set evaluation"
```

---

### Task 22: README, polling terjadwal, deploy, dan persiapan submit

**Files:**
- Create: `README.md` (ganti bawaan create-next-app), `.github/workflows/poll.yml`
- Modify: `docs/superpowers/specs/2026-09-22-correlation-explainer-design.md` (hanya kalau ada deviasi yang ditemukan saat implementasi)

**Interfaces:**
- Consumes: semua perintah dan env dari task sebelumnya.

- [ ] **Step 1: Buat `.github/workflows/poll.yml`**

```yaml
name: poll-news
on:
  schedule:
    - cron: '0 1,5,9 * * 1-5' # 08:00, 12:00, 16:00 WIB on weekdays
  workflow_dispatch: {}
jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger automatic news receiver
        run: curl -fsS -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" "${{ secrets.APP_URL }}/api/cron/poll"
```

- [ ] **Step 2: Tulis `README.md`**

````markdown
# Correlation Explainer

> *Correlation Explainer mengubah berita dan event apa pun menjadi daftar saham IDX yang terkait, beserta bukti reaksi pasar dari data Sectors, sehingga investor pemula paham "apa hubungannya berita ini dengan saham itu" tanpa menerima saran investasi.*

Sectors Hackathon 2026 · Track: **AI Agents & Assistants**

**Disclaimer:** Informasi ini adalah analisis data historis dan bukan saran investasi. Keterkaitan tidak berarti sebab-akibat. Keputusan investasi sepenuhnya tanggung jawab Anda.

## Fitur
- **Penerima berita otomatis:** berita IDX dari Sectors ditarik 3× sehari pada hari bursa. Analisis berjalan saat diklik.
- **Tempel link atau teks:** berita apa pun (termasuk makro dan geopolitik) dipetakan ke saham IDX.
- **Retrospektif:** abnormal return dibanding IHSG, uji signifikansi (z-score), foreign flow, dan ringkasan per subsektor.
- **Prospektif (HIPOTESIS):** keterkaitan dan pola historis dari event serupa.
- **Hemat kredit:** cache-first, fixture, dan batas budget yang tegas (peringatan 80%, blokir 90%).

## Arsitektur
Next.js 15 + TypeScript · SQLite/libSQL · OpenAI structured outputs · Sectors REST API v2.
Detail: `docs/superpowers/specs/2026-09-22-correlation-explainer-design.md`.

| Data Sectors yang dipakai | Endpoint |
|---|---|
| Daftar emiten, grup usaha, dan anggota indeks | `/v2/companies/` (screener) |
| Afiliasi grup | `/v2/company/report/{symbol}/?sections=overview` |
| Harga saham dan IHSG | `/v2/daily/{symbol}/`, `/v2/index-daily/ihsg/` |
| Foreign flow | `/v2/foreign-flow/{symbol}/` |
| Top losers | `/v2/companies/top-changes/` |
| Feed berita | `/v2/news/` |

## Menjalankan
```bash
pnpm install
cp .env.example .env.local        # isi SECTORS_API_KEY dan OPENAI_API_KEY
# Tanpa kredit dan tanpa LLM (data palsu):
SECTORS_MODE=fake LLM_MODE=fake FAKE_SHOCK_DAY=2026-03-02 pnpm dev
# Dengan data asli:
SECTORS_MODE=live LLM_MODE=openai pnpm dev
```

| Perintah | Fungsi |
|---|---|
| `pnpm test` / `pnpm e2e` | Unit/integration test (fixture) / E2E (mode palsu) |
| `pnpm record` | Rekam fixture asli (sekali, ~15–20 kredit) |
| `pnpm poll` | Tarik berita baru secara manual |
| `pnpm seed:history --tag <slug> --since YYYY-MM-DD --limit 15` | Bangun pustaka pola historis |
| `pnpm eval` | Presisi/recall pemetaan pada golden set |

## Aturan kredit tim (1.000 total)
Anggaran ada di spec §6. Pemakaian bisa dilihat di banner beranda dan `GET /api/credits`. **Jangan memanggil API asli dari test.**

Tag berita (hasil `pnpm record`), untuk seed histori: `<isi daftar slug yang dicetak Task 8, minimal slug untuk Politics & Regulation>`

## Golden set
`data/golden-set.json` berisi 8–10 event nyata dengan subsektor dan saham yang diharapkan (diberi label oleh tim). Hasil terakhir: `<isi output pnpm eval>`

## Deploy (opsional)
1. `turso db create correlation-explainer`, lalu ambil URL dan token.
2. Vercel: import repo, lalu set env `DATABASE_URL=libsql://...`, `DATABASE_AUTH_TOKEN`, `SECTORS_MODE=live`, `SECTORS_API_KEY`, `LLM_MODE=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `CRON_SECRET`.
3. GitHub → Settings → Secrets: `APP_URL` (URL Vercel) dan `CRON_SECRET` untuk workflow `poll-news`.
````

Setelah Task 8 dan Task 21 selesai, isi dua baris bertanda `<...>` di README dengan hasil nyata (daftar tag dan angka evaluasi). Keduanya bukan placeholder kode, melainkan data yang baru ada setelah script dijalankan.

- [ ] **Step 3: Verifikasi akhir**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e`
Expected: semua lolos. CI hijau di GitHub.

- [ ] **Step 4: Commit dan push**

```bash
git add README.md .github/workflows/poll.yml
git commit -m "docs: README, scheduled news polling and deploy notes"
git push
```

- [ ] **Step 5: Checklist submit (sebelum 30 Sep 2026, 23:59 WIB)**

- [ ] Repo GitHub **publik** (wajib tetap publik 90 hari setelah pengumuman)
- [ ] Video teaser 1 menit (YouTube atau media sosial)
- [ ] Video walkthrough maksimal 3 menit (YouTube/Vimeo/Drive/Loom). Skenario: (1) pidato atau kebijakan BUMN, (2) tempel link berita global, (3) event prospektif dengan pola historis, (4) angka golden set
- [ ] Problem statement satu kalimat (ada di README), track **AI Agents & Assistants**, dan nama anggota tim
- [ ] Post di Instagram/LinkedIn/Threads/TikTok dengan tag akun resmi Sectors, memakai template thumbnail
- [ ] **Setelah submit, jangan ada commit atau push lagi** (repo dibekukan). Pengecualian: kredensial bocor, setelah lapor ke panitia di Slack
