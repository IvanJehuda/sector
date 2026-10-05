# Hitung Ulang Laporan HIPOTESIS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Laporan HIPOTESIS dianalisis ulang otomatis setelah sesi bursa sesudah beritanya tutup, dan tabel saham menyembunyikan kolom harga bila tidak ada satu pun saham yang punya data reaksi.

**Architecture:** Fungsi murni `pickRemeasure` memilih satu laporan HIPOTESIS yang sudah bisa diukur, memakai `listProspectiveReports` dan kunci `kv` `remeasure:<eventId>` untuk membatasi satu percobaan per hari. `claimAutoAnalysis` mendahulukan laporan itu sebelum berita baru, lalu `/api/cron/analyze` memanggil `analyzeEvent(id, deps, { refresh: true })`, yang menimpa laporan HIPOTESIS tetapi tidak pernah menimpa laporan retrospektif. Di UI, `showReactionColumns` menentukan apakah kolom "Dibanding pasar" dan "Gerak" dirender.

**Tech Stack:** Next.js 15 (App Router), TypeScript, libSQL, Tailwind v4, Vitest (lingkungan `node`, tanpa test komponen), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-remeasure-hypotheses-design.md`

## Global Constraints

- "JANGAN memanggil API Sectors asli dari test atau saat eksperimen." Test memakai `createFakeMarketData` dan `createFakeLlm`. Jangan jalankan `pnpm dev` dengan `SECTORS_MODE=live` atau `LLM_MODE=openai`.
- `lib/domain.ts` **tidak diubah**. `AutoAnalysisResult` tinggal di `lib/pipeline/auto.ts`.
- Batas kredit memakai penjaga yang ada (`publicAnalysisBlockReason`); tidak ada anggaran atau env baru.
- Laporan bermode `retrospective` tidak pernah ditimpa.
- "TDD: tulis test dulu. Sebelum menyatakan selesai, jalankan `pnpm test && pnpm typecheck` dan tunjukkan hasilnya."
- "Teks UI dalam Bahasa Indonesia. Kode dan identifier dalam bahasa Inggris." Teks yang tampil wajib lolos `findBannedPhrases()`.
- **Kelas Tailwind harus string literal utuh.** Kelas yang disusun dari potongan tidak pernah di-generate.
- Akhiri setiap pesan commit dengan baris `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Merge dan push ke `main` memicu deploy produksi: hanya dengan izin manusia, lewat `git checkout main && git merge --ff-only <branch> && git push origin main` dari folder utama.

## Review Focus

1. **Libur bursa di hari kerja**: analisis ulang tetap HIPOTESIS dan tidak boleh dicoba berulang di hari yang sama (memakan kuota harian). Dikunci di Task 1 (`lastAttempt === today`) dan Task 4 (kunci `remeasure:` ditulis, run kedua beralih ke berita baru).
2. **Analisis ulang gagal** (Sectors/OpenAI error) tidak boleh membuat laporan hilang dari "Laporan terbaru" (yang hanya memuat status `done`). Dikunci di Task 3.
3. **Laporan retrospektif tertimpa** oleh `refresh`. Dikunci di Task 3.
4. **Kuota habis menghanguskan percobaan hari itu** (kunci `remeasure:` ditulis padahal tidak ada analisis). Dikunci di Task 4.
5. **Grid tabel saham runtuh** karena kelas Tailwind disusun dari potongan, sehingga kolom menumpuk. Dikunci di Task 5 lewat e2e yang membaca `grid-template-columns` judul tabel.

---

### Task 1: Pemilih laporan yang dihitung ulang

**Files:**
- Modify: `lib/market/dates.ts` (tambahkan `firstWeekdayOnOrAfter` setelah `addDays`)
- Modify: `lib/events/auto-pick.ts` (hapus salinan lokal `firstWeekdayOnOrAfter`, impor dari `@/lib/market/dates`)
- Create: `lib/events/remeasure-pick.ts`
- Test: `tests/market/dates.test.ts`, `tests/events/remeasure-pick.test.ts`

**Interfaces:**
- Consumes: `addDays`, `eventCalendarDate` dari `@/lib/market/dates`.
- Produces:
  - `firstWeekdayOnOrAfter(day: string): string` dari `@/lib/market/dates`
  - `interface RemeasureCandidate { eventId: string; publishedAt: string; lastAttempt: string | null }` dari `@/lib/events/remeasure-pick`
  - `pickRemeasure(candidates: RemeasureCandidate[], today: string): string | null` dari `@/lib/events/remeasure-pick`

- [ ] **Step 1: Tulis test yang gagal**

Di `tests/market/dates.test.ts`, ubah import menjadi:

```ts
import { addDays, eventCalendarDate, firstTradingDayOnOrAfter, firstWeekdayOnOrAfter, priceWindow } from '@/lib/market/dates';
```

lalu tambahkan di akhir file:

```ts
describe('firstWeekdayOnOrAfter', () => {
  it('moves weekend days to Monday and keeps weekdays', () => {
    expect(firstWeekdayOnOrAfter('2026-10-03')).toBe('2026-10-05'); // Saturday
    expect(firstWeekdayOnOrAfter('2026-10-04')).toBe('2026-10-05'); // Sunday
    expect(firstWeekdayOnOrAfter('2026-10-02')).toBe('2026-10-02'); // Friday
  });
});
```

Buat `tests/events/remeasure-pick.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pickRemeasure, type RemeasureCandidate } from '@/lib/events/remeasure-pick';

const TODAY = '2026-10-05'; // Monday

const report = (eventId: string, publishedAt: string, lastAttempt: string | null = null): RemeasureCandidate => ({
  eventId,
  publishedAt,
  lastAttempt,
});

describe('pickRemeasure', () => {
  it('picks a hypothesis report once the session after its news has closed', () => {
    expect(pickRemeasure([report('a', '2026-10-02T09:00:00')], TODAY)).toBe('a');
  });

  it('waits for the Monday close on Friday-evening news', () => {
    // After 16:00 WIB on Friday the event day is Saturday, so Monday is the first session.
    expect(pickRemeasure([report('a', '2026-10-02T19:50:00')], TODAY)).toBeNull();
    expect(pickRemeasure([report('a', '2026-10-02T19:50:00')], '2026-10-06')).toBe('a');
  });

  it('tries each report at most once a day', () => {
    expect(pickRemeasure([report('a', '2026-10-01T09:00:00', TODAY)], TODAY)).toBeNull();
    expect(pickRemeasure([report('a', '2026-10-01T09:00:00', '2026-10-02')], TODAY)).toBe('a');
  });

  it('skips reports whose date cannot be read', () => {
    expect(pickRemeasure([report('a', 'bukan tanggal'), report('b', '2026-10-01T09:00:00')], TODAY)).toBe('b');
  });

  it('prefers the newest news, which is what the homepage shows', () => {
    expect(pickRemeasure([report('old', '2026-09-30T09:00:00'), report('new', '2026-10-01T09:00:00')], TODAY)).toBe('new');
  });

  it('returns null when nothing is waiting', () => {
    expect(pickRemeasure([], TODAY)).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `pnpm vitest run tests/market/dates.test.ts tests/events/remeasure-pick.test.ts`
Expected: FAIL. `firstWeekdayOnOrAfter` tidak diekspor dari `@/lib/market/dates`, dan modul `@/lib/events/remeasure-pick` tidak ditemukan.

- [ ] **Step 3: Implementasi**

Di `lib/market/dates.ts`, tepat setelah fungsi `addDays`, tambahkan:

```ts
/** The first weekday on or after `day`: the earliest session that can close on a weekend article. */
export function firstWeekdayOnOrAfter(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 6 ? addDays(day, 2) : weekday === 0 ? addDays(day, 1) : day;
}
```

Di `lib/events/auto-pick.ts`, ganti baris import kedua menjadi:

```ts
import { eventCalendarDate, firstWeekdayOnOrAfter } from '@/lib/market/dates';
```

lalu hapus seluruh blok fungsi lokal ini (termasuk komentar JSDoc di atasnya):

```ts
/** The first weekday on or after `day`: the earliest session that can close on a weekend article. */
function firstWeekdayOnOrAfter(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 6 ? addDays(day, 2) : weekday === 0 ? addDays(day, 1) : day;
}
```

Buat `lib/events/remeasure-pick.ts`:

```ts
import { eventCalendarDate, firstWeekdayOnOrAfter } from '@/lib/market/dates';

export interface RemeasureCandidate {
  eventId: string;
  publishedAt: string;
  /** WIB date of the last re-analysis attempt, or null when never retried. */
  lastAttempt: string | null;
}

/**
 * The hypothesis report to analyse again: its first session after the news has closed before `today`,
 * and it was not already retried today. Newest news first, since that is what the homepage shows.
 */
export function pickRemeasure(candidates: RemeasureCandidate[], today: string): string | null {
  let best: { eventId: string; day: string } | null = null;
  for (const c of candidates) {
    if (c.lastAttempt === today) continue;
    let day: string;
    try {
      day = eventCalendarDate(c.publishedAt);
    } catch {
      continue;
    }
    if (firstWeekdayOnOrAfter(day) >= today) continue;
    if (!best || day > best.day) best = { eventId: c.eventId, day };
  }
  return best?.eventId ?? null;
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lolos**

Run: `pnpm vitest run tests/market/dates.test.ts tests/events/remeasure-pick.test.ts tests/events/auto-pick.test.ts && pnpm typecheck`
Expected: semua PASS (termasuk test `auto-pick` lama, yang membuktikan pemindahan fungsi tidak mengubah perilaku), typecheck tanpa output.

- [ ] **Step 5: Commit**

```bash
git add lib/market/dates.ts lib/events/auto-pick.ts lib/events/remeasure-pick.ts tests/market/dates.test.ts tests/events/remeasure-pick.test.ts
git commit -m "feat(events): pick hypothesis reports whose next session has closed"
```

---

### Task 2: Daftar laporan HIPOTESIS dari database

**Files:**
- Modify: `lib/db/repo.ts` (tambahkan `listProspectiveReports` setelah `listRetrospectiveReports`)
- Test: `tests/db/repo.test.ts`

**Interfaces:**
- Consumes: tabel `reports` (`event_id`, `mode`) dan `events` (`id`, `published_at`, `status`).
- Produces: `listProspectiveReports(db: Db): Promise<{ eventId: string; publishedAt: string }[]>` dari `@/lib/db/repo`.

- [ ] **Step 1: Tulis test yang gagal**

Di `tests/db/repo.test.ts`, tambahkan `listProspectiveReports,` ke daftar import dari `'@/lib/db/repo'` (urutan abjad, setelah `listEvents,`), lalu tambahkan di akhir file:

```ts
describe('listProspectiveReports', () => {
  it('lists hypothesis reports of finished events with their publish time', async () => {
    const hyp = (await insertEvent(db, input)).event;
    const measured = (await insertEvent(db, { ...input, url: 'https://example.com/berita-b' })).event;
    const running = (await insertEvent(db, { ...input, url: 'https://example.com/berita-c' })).event;
    for (const e of [hyp, measured]) await setEventStatus(db, e.id, 'done');
    await setEventStatus(db, running.id, 'analyzing');
    await saveReport(db, makeReport({ eventId: hyp.id, mode: 'prospective', market: null }));
    await saveReport(db, makeReport({ eventId: measured.id, mode: 'retrospective' }));
    await saveReport(db, makeReport({ eventId: running.id, mode: 'prospective', market: null }));

    expect(await listProspectiveReports(db)).toEqual([{ eventId: hyp.id, publishedAt: input.publishedAt }]);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `pnpm vitest run tests/db/repo.test.ts`
Expected: FAIL karena `listProspectiveReports` tidak diekspor (`is not a function`), test lain lolos.

- [ ] **Step 3: Implementasi**

Di `lib/db/repo.ts`, tepat setelah fungsi `listRetrospectiveReports`, tambahkan:

```ts
/** Hypothesis reports of finished events: the ones a later trading session can turn into measured reports. */
export async function listProspectiveReports(db: Db): Promise<{ eventId: string; publishedAt: string }[]> {
  const r = await db.execute(
    `SELECT e.id, e.published_at FROM reports r JOIN events e ON e.id = r.event_id
     WHERE r.mode = 'prospective' AND e.status = 'done'`,
  );
  return r.rows.map((row) => ({ eventId: String(row.id), publishedAt: String(row.published_at) }));
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lolos**

Run: `pnpm vitest run tests/db/repo.test.ts && pnpm typecheck`
Expected: semua PASS, typecheck tanpa output.

- [ ] **Step 5: Commit**

```bash
git add lib/db/repo.ts tests/db/repo.test.ts
git commit -m "feat(db): list hypothesis reports of finished events"
```

---

### Task 3: `analyzeEvent` bisa menganalisis ulang laporan HIPOTESIS

**Files:**
- Modify: `lib/pipeline/analyze.ts` (signature `analyzeEvent`, pengecekan laporan yang ada, blok `catch` di akhir)
- Test: `tests/pipeline/analyze.test.ts`

**Interfaces:**
- Consumes: `getReport`, `saveReport`, `setEventStatus` dari `@/lib/db/repo` (sudah diimpor).
- Produces: `analyzeEvent(eventId: string, deps: PipelineDeps, options?: { refresh?: boolean }): Promise<Report>`. Tanpa `refresh` perilaku tidak berubah.

- [ ] **Step 1: Tulis test yang gagal**

Di `tests/pipeline/analyze.test.ts`, tambahkan tiga test ini di dalam `describe('analyzeEvent', …)`, tepat setelah test `'produces a prospective hypothesis with analogs for a future event'`:

```ts
  it('refresh turns a hypothesis into a measured report once a session has closed', async () => {
    const { event } = await insertEvent(db, baseEvent);
    const early = createFakeMarketData({ shockDay: '2026-03-09', today: '2026-03-06' });
    const first = await analyzeEvent(event.id, { db, market: early, llm: fakeLlm(), ledger: memoryLedger() });
    expect(first.mode).toBe('prospective');

    const report = await analyzeEvent(event.id, { db, market, llm: fakeLlm(), ledger: memoryLedger() }, { refresh: true });

    expect(report.mode).toBe('retrospective');
    expect(report.market?.t0).toBe('2026-03-09');
    expect(report.findings.some((f) => f.reaction !== null)).toBe(true);
    expect((await getReport(db, event.id))?.mode).toBe('retrospective');
    expect((await getEvent(db, event.id))?.status).toBe('done');
  });

  it('refresh never rewrites a measured report', async () => {
    const { event } = await insertEvent(db, baseEvent);
    const deps = { db, market, llm: fakeLlm(), ledger: memoryLedger() };
    const first = await analyzeEvent(event.id, deps);
    const spy = vi.spyOn(market, 'universe');

    expect(await analyzeEvent(event.id, deps, { refresh: true })).toEqual(first);
    expect(spy).not.toHaveBeenCalled();
  });

  it('a failed refresh keeps the hypothesis report listed', async () => {
    const { event } = await insertEvent(db, baseEvent);
    const early = createFakeMarketData({ shockDay: '2026-03-09', today: '2026-03-06' });
    const first = await analyzeEvent(event.id, { db, market: early, llm: fakeLlm(), ledger: memoryLedger() });
    const broken = createFakeLlm({ event_profile: { broken: true } });

    await expect(analyzeEvent(event.id, { db, market, llm: broken, ledger: memoryLedger() }, { refresh: true })).rejects.toBeInstanceOf(
      ProfileExtractionError,
    );
    expect((await getEvent(db, event.id))?.status).toBe('done');
    expect(await getReport(db, event.id)).toEqual(first);
  });
```

`baseEvent` terbit `2026-03-07T09:00:00` (Sabtu). Pasar palsu dengan `today: '2026-03-06'` tidak punya hari bursa pada atau setelah 7 Maret, jadi laporan pertama HIPOTESIS. Pasar default (`today: '2026-03-20'`) punya 9 Maret sebagai hari bursa pertama.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `pnpm vitest run tests/pipeline/analyze.test.ts`
Expected: test pertama FAIL (`expected 'prospective' to be 'retrospective'`) dan test ketiga FAIL (`ProfileExtractionError` tidak dilempar karena laporan lama dikembalikan, sehingga promise resolve). Test kedua lolos, karena perilaku sekarang memang tidak menimpa. Typecheck juga akan melaporkan argumen ketiga yang belum ada; itu bagian dari RED.

- [ ] **Step 3: Implementasi**

Di `lib/pipeline/analyze.ts`, ganti:

```ts
export async function analyzeEvent(eventId: string, deps: PipelineDeps): Promise<Report> {
  const { db, market, llm, ledger } = deps;
  const now = deps.now ?? (() => new Date());
  const existing = await getReport(db, eventId);
  if (existing) return existing;
```

menjadi:

```ts
/**
 * Analyses an event and stores its report. A stored report is returned as is, except that `refresh`
 * re-runs a hypothesis report: once a session has closed it becomes a measured report.
 * Measured reports are never rewritten.
 */
export async function analyzeEvent(eventId: string, deps: PipelineDeps, options: { refresh?: boolean } = {}): Promise<Report> {
  const { db, market, llm, ledger } = deps;
  const now = deps.now ?? (() => new Date());
  const existing = await getReport(db, eventId);
  if (existing && !(options.refresh && existing.mode === 'prospective')) return existing;
```

Lalu ganti blok `catch` di akhir fungsi:

```ts
  } catch (err) {
    await setEventStatus(db, eventId, 'failed', userMessage(err));
    throw err;
  }
```

menjadi:

```ts
  } catch (err) {
    // A failed refresh still has the old hypothesis report; keep it listed instead of marking the event failed.
    if (existing) await setEventStatus(db, eventId, 'done', null);
    else await setEventStatus(db, eventId, 'failed', userMessage(err));
    throw err;
  }
```

- [ ] **Step 4: Jalankan test untuk memastikan lolos**

Run: `pnpm vitest run tests/pipeline/analyze.test.ts && pnpm typecheck`
Expected: semua PASS, typecheck tanpa output.

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/analyze.ts tests/pipeline/analyze.test.ts
git commit -m "feat(pipeline): re-run hypothesis reports on refresh, never measured ones"
```

---

### Task 4: Analisis otomatis mendahulukan hitung ulang

**Files:**
- Modify: `lib/pipeline/auto.ts`
- Modify: `app/api/cron/analyze/route.ts`
- Test: `tests/pipeline/auto.test.ts`

**Interfaces:**
- Consumes: `pickRemeasure` (Task 1), `listProspectiveReports` (Task 2), `analyzeEvent(…, { refresh })` (Task 3), `kvGet`, `kvSet` dari `@/lib/db/repo`.
- Produces:
  - `remeasureKey(eventId: string): string` dari `@/lib/pipeline/auto`, yang menghasilkan `` `remeasure:${eventId}` ``
  - `AutoAnalysisResult = { eventId: string; refresh?: true } | { skipped: 'no-candidate' | 'blocked' | 'claimed-elsewhere' }`

- [ ] **Step 1: Tulis test yang gagal**

Di `tests/pipeline/auto.test.ts`, ubah import repo dan tambahkan dua import:

```ts
import { getEvent, insertEvent, kvGet, saveReport, setEventStatus } from '@/lib/db/repo';
import type { EventInput } from '@/lib/domain';
import { claimAutoAnalysis, remeasureKey } from '@/lib/pipeline/auto';
import { memoryLedger } from '@/lib/sectors/stores';
import { makeReport } from '../helpers/factories';
```

(baris `import type { EventInput }` dan `memoryLedger` sudah ada; pastikan masing-masing hanya sekali.)

Lalu tambahkan di dalam `describe('claimAutoAnalysis', …)`, setelah test terakhir:

```ts
  /** A finished hypothesis report on Thursday's news: Thursday's session has closed by Monday. */
  async function hypothesisReport() {
    const { event } = await insertEvent(db, { ...policyNews, url: 'https://example.com/hipotesis', publishedAt: '2026-10-01T09:00:00' });
    await saveReport(db, makeReport({ eventId: event.id, mode: 'prospective', market: null }));
    await setEventStatus(db, event.id, 'done');
    return event;
  }

  it('re-measures a hypothesis report before analysing new articles', async () => {
    const hyp = await hypothesisReport();
    await insertEvent(db, policyNews);

    expect(await claim()).toEqual({ eventId: hyp.id, refresh: true });
    expect((await getEvent(db, hyp.id))?.status).toBe('analyzing');
    expect(await kvGet(db, remeasureKey(hyp.id))).toBe(TODAY);
  });

  it('retries each hypothesis report at most once a day, then moves on to new articles', async () => {
    const hyp = await hypothesisReport();
    const { event: fresh } = await insertEvent(db, policyNews);
    await claim();
    await setEventStatus(db, hyp.id, 'done'); // the re-run ended, still a hypothesis (e.g. an exchange holiday)

    expect(await claim()).toEqual({ eventId: fresh.id });
  });

  it('keeps the retry for later when the guard blocks the run', async () => {
    const hyp = await hypothesisReport();

    expect(await claim({ config: { ...OPEN, dailyLimit: 0 } })).toEqual({ skipped: 'blocked' });
    expect(await kvGet(db, remeasureKey(hyp.id))).toBeNull();
    expect((await getEvent(db, hyp.id))?.status).toBe('done');
  });
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `pnpm vitest run tests/pipeline/auto.test.ts`
Expected: FAIL. `remeasureKey` tidak diekspor, sehingga ketiga test baru gagal; test lama tetap lolos.

- [ ] **Step 3: Implementasi `lib/pipeline/auto.ts`**

Ganti baris import repo dan auto-pick menjadi:

```ts
import { ANALYSIS_STALE_MS, claimEventForAnalysis, countRecentAnalyses, kvGet, kvSet, listEvents, listProspectiveReports } from '@/lib/db/repo';
import { pickAutoAnalysis } from '@/lib/events/auto-pick';
import { pickRemeasure } from '@/lib/events/remeasure-pick';
```

Ganti tipe hasil:

```ts
export type AutoAnalysisResult = { eventId: string; refresh?: true } | { skipped: 'no-candidate' | 'blocked' | 'claimed-elsewhere' };

/** kv key holding the WIB date a hypothesis report was last re-analysed. */
export const remeasureKey = (eventId: string) => `remeasure:${eventId}`;
```

Ganti JSDoc dan isi `claimAutoAnalysis` menjadi:

```ts
/**
 * Picks and claims at most one analysis after a news poll; the caller runs it.
 * A hypothesis report whose next session has closed comes first (re-run with `refresh`); otherwise
 * the newest unanalysed policy article. Goes through the same guard as visitor analyses, so automatic
 * runs cannot spend past the limits set for them.
 */
export async function claimAutoAnalysis(deps: {
  db: Db;
  ledger: CreditLedger;
  budget: number;
  config: PublicAnalysisConfig;
  today: string;
  now: Date;
}): Promise<AutoAnalysisResult> {
  const pending = await listProspectiveReports(deps.db);
  const candidates = [];
  for (const p of pending) candidates.push({ ...p, lastAttempt: await kvGet(deps.db, remeasureKey(p.eventId)) });
  const remeasure = pickRemeasure(candidates, deps.today);
  const pick = remeasure ?? pickAutoAnalysis(await listEvents(deps.db, SCAN_LIMIT), deps.today)?.id ?? null;
  if (!pick) return { skipped: 'no-candidate' };

  const blocked = publicAnalysisBlockReason({
    used: await deps.ledger.total(),
    budget: deps.budget,
    analysesLast24h: await countRecentAnalyses(deps.db, new Date(deps.now.getTime() - DAY_MS).toISOString()),
    dailyLimit: deps.config.dailyLimit,
    publicRatio: deps.config.publicRatio,
  });
  if (blocked) return { skipped: 'blocked' };

  // Recorded before the claim: one attempt per report per day, even if the re-run fails or stays a hypothesis.
  if (remeasure) await kvSet(deps.db, remeasureKey(remeasure), deps.today);
  const nowIso = deps.now.toISOString();
  const staleBefore = new Date(deps.now.getTime() - ANALYSIS_STALE_MS).toISOString();
  if (!(await claimEventForAnalysis(deps.db, pick, nowIso, staleBefore))) return { skipped: 'claimed-elsewhere' };
  return remeasure ? { eventId: pick, refresh: true } : { eventId: pick };
}
```

- [ ] **Step 4: Teruskan `refresh` di route**

Di `app/api/cron/analyze/route.ts`, ganti:

```ts
  if ('eventId' in auto) {
    const id = auto.eventId;
    after(async () => {
      try {
        await analyzeEvent(id, deps);
```

menjadi:

```ts
  if ('eventId' in auto) {
    const { eventId: id, refresh } = auto;
    after(async () => {
      try {
        await analyzeEvent(id, deps, { refresh });
```

dan ubah komentar JSDoc `GET` menjadi `/** Called by the scheduled workflow after each poll: re-measures one hypothesis report, or analyses one policy article. */`.

- [ ] **Step 5: Jalankan test untuk memastikan lolos**

Run: `pnpm vitest run tests/pipeline/auto.test.ts && pnpm typecheck`
Expected: semua PASS (5 lama + 3 baru), typecheck tanpa output.

- [ ] **Step 6: Commit**

```bash
git add lib/pipeline/auto.ts app/api/cron/analyze/route.ts tests/pipeline/auto.test.ts
git commit -m "feat(cron): re-measure one closed hypothesis report before new articles"
```

---

### Task 5: Sembunyikan kolom harga bila tidak ada data reaksi

**Files:**
- Modify: `lib/ui/present.ts` (tambahkan `showReactionColumns`)
- Modify: `components/ReportView.tsx` (judul tabel saham dan `FindingRow`)
- Test: `tests/ui/present.test.ts`, `e2e/analyze.spec.ts`

**Interfaces:**
- Consumes: `StockFinding` dari `@/lib/domain`.
- Produces: `showReactionColumns(findings: Pick<StockFinding, 'reaction'>[]): boolean` dari `@/lib/ui/present`.

- [ ] **Step 1: Tulis test yang gagal**

Di `tests/ui/present.test.ts`, tambahkan `showReactionColumns,` ke import dari `'@/lib/ui/present'` (sebelum `splitNewsInput,`), lalu tambahkan di akhir file:

```ts
describe('showReactionColumns', () => {
  const reaction = { t0: '2026-03-09', tEnd: '2026-03-16', days: 6, car: -0.05, marketReturn: 0.001, sigma: 0.01, zScore: -3, significant: true };

  it('shows price columns when at least one stock has a measured reaction', () => {
    expect(showReactionColumns([{ reaction: null }, { reaction }])).toBe(true);
  });

  it('hides them when no stock has one, as on every hypothesis report', () => {
    expect(showReactionColumns([{ reaction: null }, { reaction: null }])).toBe(false);
    expect(showReactionColumns([])).toBe(false);
  });
});
```

Di `e2e/analyze.spec.ts`, pada test `'pasted text produces a retrospective report with evidence and disclaimer'`, sisipkan tepat sebelum baris `// The AI's guess sits beside what the market actually did, per sub-sector.`:

```ts
  // Measured reports keep the price columns, and the header really forms five columns.
  const stocksHeader = page.locator('[data-findings-header]');
  await expect(stocksHeader.getByText('Dibanding pasar', { exact: true })).toBeVisible();
  expect(await stocksHeader.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(5);
```

Pada test `'a hypothesis report leads with the impact table and shows no measured reaction'`, sisipkan tepat sebelum baris `const tableTop = (await impact.boundingBox())!.y;`:

```ts
  // No stock has a price reaction yet, so the price columns are gone and the header forms three columns.
  const stocksHeader = page.locator('[data-findings-header]');
  await expect(stocksHeader.getByText('Dibanding pasar', { exact: true })).toHaveCount(0);
  await expect(stocksHeader.getByText('Gerak', { exact: true })).toHaveCount(0);
  expect(await stocksHeader.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(3);
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `pnpm vitest run tests/ui/present.test.ts`
Expected: FAIL karena `showReactionColumns` tidak diekspor.

Run: `pnpm e2e`
Expected: kedua test laporan FAIL di `[data-findings-header]` karena atributnya belum ada. Test lain lolos. Kalau ada server dev yang masih berjalan di port 3100, matikan dulu (`reuseExistingServer`).

- [ ] **Step 3: Implementasi fungsi murni**

Di `lib/ui/present.ts`, tambahkan di baris paling atas:

```ts
import type { StockFinding } from '@/lib/domain';
```

lalu tambahkan setelah fungsi `tone`:

```ts
/** The price columns only help when at least one stock has a measured reaction; hypothesis reports have none. */
export function showReactionColumns(findings: Pick<StockFinding, 'reaction'>[]): boolean {
  return findings.some((f) => f.reaction !== null);
}
```

- [ ] **Step 4: Pasang di `ReportView`**

Di `components/ReportView.tsx`:

(a) Tambahkan `showReactionColumns` ke import dari `'@/lib/ui/present'` (urutan abjad, setelah `formatDateId,`).

(b) Tambahkan konstanta ini tepat setelah konstanta `CREATED_AT`:

```ts
// Whole class names only: Tailwind never generates a class assembled from fragments.
const STOCK_COLS = {
  withPrice: 'md:grid-cols-[150px_minmax(0,1fr)_160px_100px_100px]',
  withoutPrice: 'md:grid-cols-[150px_minmax(0,1fr)_100px]',
} as const;
```

(c) Ganti `FindingRow` dari baris `function FindingRow(…` sampai `</summary>` dengan:

```tsx
function FindingRow({ f, open, priceCols }: { f: StockFinding; open: boolean; priceCols: boolean }) {
  const r = f.reaction;
  const flow = foreignFlowText(f.netForeignInflow);
  return (
    <details open={open} className="group border-b border-line last:border-b-0 open:bg-white/[0.03]">
      <summary
        className={`grid cursor-pointer list-none grid-cols-2 gap-x-3 gap-y-1.5 px-4 py-4 text-sm hover:bg-white/[0.045] ${priceCols ? STOCK_COLS.withPrice : STOCK_COLS.withoutPrice} md:items-center md:px-5 [&::-webkit-details-marker]:hidden`}
      >
        <span className="flex flex-col">
          <span className="font-mono">{f.candidate.symbol}</span>
          <span className="text-xs text-white/50">{f.candidate.name}</span>
        </span>
        <span className="text-white/80 max-md:text-right">{LINK_TYPE_LABEL[f.candidate.linkType]}</span>
        {priceCols && (
          <>
            <span className={r ? (r.significant ? tone(r.car) : 'text-white/80') : 'text-white/50'}>{r ? describeVsMarket(r.car) : '—'}</span>
            <span className={`max-md:text-right ${r?.significant ? 'text-amber' : 'text-white/60'}`}>{r ? unusualLabel(r.significant) : '—'}</span>
          </>
        )}
        <span className="max-md:col-span-2">
          <span className={`inline-block border px-2 py-0.5 font-mono text-[11px] ${EVIDENCE_TAG[f.confidence]}`}>
            {CONFIDENCE_LABEL[f.confidence].replace('Bukti ', '').toUpperCase()}
          </span>
        </span>
      </summary>
```

Bagian setelah `</summary>` (isi `<div className="flex flex-col gap-2 px-4 pb-4 md:px-5">` dan seterusnya) tidak berubah.

(d) Di dalam `ReportView`, tepat setelah baris `const span = withPrice[0]?.reaction;`, tambahkan:

```ts
  const priceCols = showReactionColumns(report.findings);
```

(e) Ganti judul tabel saham dan pemanggilan baris:

```tsx
              <div className="hidden grid-cols-[150px_minmax(0,1fr)_160px_100px_100px] gap-3 border-b border-line px-5 py-3 text-xs text-white/55 md:grid" aria-hidden="true">
                <span>Saham</span>
                <span>Kenapa terkait</span>
                <span>Dibanding pasar</span>
                <span>Gerak</span>
                <span>Bukti</span>
              </div>
              {report.findings.map((f, i) => (
                <FindingRow key={f.candidate.symbol} f={f} open={i === 0} />
              ))}
```

menjadi:

```tsx
              <div
                data-findings-header
                className={`hidden gap-3 border-b border-line px-5 py-3 text-xs text-white/55 md:grid ${priceCols ? STOCK_COLS.withPrice : STOCK_COLS.withoutPrice}`}
                aria-hidden="true"
              >
                <span>Saham</span>
                <span>Kenapa terkait</span>
                {priceCols && (
                  <>
                    <span>Dibanding pasar</span>
                    <span>Gerak</span>
                  </>
                )}
                <span>Bukti</span>
              </div>
              {report.findings.map((f, i) => (
                <FindingRow key={f.candidate.symbol} f={f} open={i === 0} priceCols={priceCols} />
              ))}
```

- [ ] **Step 5: Jalankan test untuk memastikan lolos**

Run: `pnpm vitest run tests/ui/present.test.ts && pnpm typecheck && pnpm e2e`
Expected: unit PASS, typecheck tanpa output, e2e 7 passed.

- [ ] **Step 6: Jalankan seluruh pemeriksaan**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: semua test lolos (301 sebelumnya + 1 dates + 6 remeasure-pick + 1 repo + 3 analyze + 3 auto + 2 present = 317), typecheck tanpa output, lint 0 error (3 warning lama dibiarkan), build sukses.

- [ ] **Step 7: Commit**

```bash
git add lib/ui/present.ts components/ReportView.tsx tests/ui/present.test.ts e2e/analyze.spec.ts
git commit -m "feat(ui): hide the price columns when no stock has a measured reaction"
```

---

### Task 6: Dokumentasi dan rilis

**Files:**
- Modify: `HANDOFF.md` (baris Step 6 di §1)

**Interfaces:**
- Consumes: semua commit Task 1–5.
- Produces: produksi menghitung ulang laporan HIPOTESIS.

- [ ] **Step 1: Perbarui HANDOFF**

Di `HANDOFF.md` §1 baris Step 6, sebelum `|` penutup baris, tambahkan kalimat: "Sejak 5 Okt, `/api/cron/analyze` mendahulukan hitung ulang 1 laporan HIPOTESIS yang sesi bursa sesudah beritanya sudah tutup (maks. sekali sehari per laporan, kunci kv `remeasure:<id>`), lewat penjaga kuota yang sama; laporan retrospektif tidak pernah ditimpa. Tabel saham menyembunyikan kolom 'Dibanding pasar' dan 'Gerak' bila tidak ada saham dengan data reaksi."

```bash
git add HANDOFF.md
git commit -m "docs(handoff): record automatic re-measuring of hypothesis reports"
```

- [ ] **Step 2: Merge dan push**

Ini aksi ke branch bersama yang memicu deploy produksi, jadi **wajib minta izin manusia dulu**. Setelah disetujui, dari folder utama:

```bash
git fetch origin && git log --oneline main..origin/main
git checkout main && git merge --ff-only feat/remeasure && git push origin main
```

Perintah pertama harus tidak mencetak commit (tidak ada commit baru di `origin/main`).

- [ ] **Step 3: Verifikasi produksi**

Tunggu CI hijau dan deploy Vercel (`curl -s https://api.github.com/repos/IvanJehuda/sector/commits/<sha>/status`). Halaman dirender di browser dari `/api/events/:id`, jadi verifikasi lewat data.

Laporan HIPOTESIS baru dihitung ulang pada run `poll-news` berikutnya. Setelah run itu selesai:

```bash
python -c "
import json,urllib.request as u
B='https://correlation-explainer-idx.vercel.app'
ids=['c503bb20-57d1-4c1f-8bff-bb6e13382287']
for i in ids:
  r=json.load(u.urlopen(B+'/api/events/'+i))['report']
  print(i[:8], r['mode'], sum(1 for f in r['findings'] if f.get('reaction')), 'saham berdata')
"
```

Expected: setelah sesi bursa sesudah berita tutup dan sebuah run berjalan, satu laporan per run berubah dari `prospective` menjadi `retrospective` dengan saham berdata. Laporan yang masih `prospective` menampilkan tabel saham tanpa kolom "Dibanding pasar".
