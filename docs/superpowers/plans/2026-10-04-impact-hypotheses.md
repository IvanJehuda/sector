# Dugaan Dampak AI dan Tabel "Dampak per bidang usaha" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setiap laporan menyimpan dugaan mekanisme dampak dari AI per subsektor, lalu menampilkannya dalam satu tabel bersama reaksi nyata dan pola historis. Tidak ada prediksi harga per saham.

**Architecture:** `extractEventProfile()` sudah menghasilkan `hypotheses` (`sub_sector`, `direction`, `reason`), tetapi datanya dibuang. Rencana ini menambahkan satu field opsional `hypotheses?` di `Report`. Fungsi murni `toReportHypotheses` menyaring dugaan sebelum disimpan, dan `analyzeEvent` menyimpannya. Fungsi murni `buildImpactRows` menggabungkan dugaan, `subSectorSummary`, dan `analogs` per subsektor. Komponen `ImpactTable` merender hasilnya: di laporan retrospektif menggantikan dua kolom bawah, di laporan HIPOTESIS tampil di atas daftar saham.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind v4, Vitest (lingkungan `node`, tanpa test komponen), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-04-impact-hypotheses-design.md`

## Global Constraints

- **Tidak ada panggilan Sectors atau OpenAI baru.** Semua data sudah ada di profil dan laporan. Jangan jalankan `pnpm dev` dengan `SECTORS_MODE=live` atau `LLM_MODE=openai`. Untuk UI pakai `SECTORS_MODE=fake LLM_MODE=fake`.
- Perubahan `lib/domain.ts` **disetujui Ivan atas nama tim** (aturan 3), dibatasi pada: tipe `ImpactDirection`, interface `SubSectorHypothesis`, dan field opsional `Report.hypotheses?`. Jangan mengubah hal lain di file itu.
- "Tidak boleh ada saran investasi. Teks yang ditampilkan ke user wajib lolos `findBannedPhrases()` (lib/explain/guard.ts)." Kata terlarang mencakup `beli`, `jual`, `rekomendasi`, `target harga`, `pasti naik`, `pasti turun`, `buy`, `sell`, `hold`.
- Arah ditulis sebagai dampak, **tidak pernah** sebagai ramalan harga: `negatif` → "Tekanan", `positif` → "Dorongan", `tidak jelas` → "Belum jelas".
- "Modul kecil dengan satu tanggung jawab. Fungsi murni diletakkan di `lib/market`, `lib/explain`, dan `lib/history`." Fungsi murni UI mengikuti pola `lib/ui/`.
- "TDD: tulis test dulu. Sebelum menyatakan selesai, jalankan `pnpm test && pnpm typecheck` dan tunjukkan hasilnya."
- "Teks UI dalam Bahasa Indonesia. Kode dan identifier dalam bahasa Inggris."
- **Kelas Tailwind harus string literal utuh.** Tailwind v4 hanya men-generate kelas yang muncul utuh di sumber. Kelas yang disusun dari potongan, seperti `` `md:grid-cols-[${x}]` ``, tidak akan pernah ada di CSS.
- Akhiri setiap pesan commit dengan baris `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Rata-rata yang mendekati nol** menghasilkan *"sama dengan pasar dari pasar"*, karena kode lama menyambung `describeVsMarket(x).toLowerCase()` dengan `" dari pasar"`. Tabel baru harus menulis "sama dengan pasar". Dikunci di Task 3 (`vsMarketPhrase`).
2. **Kolom tabel yang tidak terbentuk** karena kelas Tailwind disusun dari potongan: semua sel lalu menumpuk dalam satu kolom di desktop. Dikunci di Task 4 lewat e2e yang membaca `grid-template-columns` hasil render dan menghitung jumlah kolomnya.
3. **Laporan lama tanpa `hypotheses`** menampilkan kolom "Dugaan AI" yang isinya hanya "—". Kolom itu harus disembunyikan. Dikunci di Task 3 (`impactColumns`).
4. **Nama subsektor beda huruf besar** ("banks" vs "Banks") memecah satu subsektor menjadi dua baris. Dikunci di Task 3 (test penggabungan).
5. **Alasan AI yang berbunyi seperti saran** ("jual saham bank sekarang") sampai ke halaman. Dikunci di Task 1 (penyaringan) dan Task 2 (pipeline).

---

### Task 1: Kontrak dan penyaringan dugaan AI

**Files:**
- Modify: `lib/domain.ts` (sisipkan sebelum `export interface Report {`, lalu tambahkan satu field di dalamnya)
- Create: `lib/explain/hypotheses.ts`
- Test: `tests/explain/hypotheses.test.ts`

**Interfaces:**
- Consumes: `findBannedPhrases(text: string): string[]` dari `lib/explain/guard.ts`.
- Produces:
  - `type ImpactDirection = 'negatif' | 'positif' | 'tidak jelas'` (dari `@/lib/domain`)
  - `interface SubSectorHypothesis { subSector: string; direction: ImpactDirection; reason: string }` (dari `@/lib/domain`)
  - `Report.hypotheses?: SubSectorHypothesis[]`
  - `toReportHypotheses(hypotheses: { sub_sector: string; direction: ImpactDirection; reason: string }[]): SubSectorHypothesis[]` (dari `@/lib/explain/hypotheses`)

- [ ] **Step 1: Tulis test yang gagal**

Buat `tests/explain/hypotheses.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toReportHypotheses } from '@/lib/explain/hypotheses';

describe('toReportHypotheses', () => {
  it('maps the profile shape to the report shape and trims the reason', () => {
    expect(toReportHypotheses([{ sub_sector: 'Banks', direction: 'negatif', reason: '  Porsi laba ke negara naik.  ' }])).toEqual([
      { subSector: 'Banks', direction: 'negatif', reason: 'Porsi laba ke negara naik.' },
    ]);
  });

  it('drops reasons that read as investment advice', () => {
    expect(toReportHypotheses([{ sub_sector: 'Banks', direction: 'negatif', reason: 'Sebaiknya jual saham bank.' }])).toEqual([]);
  });

  it('drops empty reasons', () => {
    expect(toReportHypotheses([{ sub_sector: 'Banks', direction: 'tidak jelas', reason: '   ' }])).toEqual([]);
  });

  it('keeps the first usable hypothesis per sub-sector, ignoring case', () => {
    expect(
      toReportHypotheses([
        { sub_sector: 'Banks', direction: 'negatif', reason: 'Beli sekarang.' },
        { sub_sector: 'banks', direction: 'positif', reason: 'Laba naik.' },
        { sub_sector: 'Banks', direction: 'negatif', reason: 'Alasan lain.' },
      ]),
    ).toEqual([{ subSector: 'banks', direction: 'positif', reason: 'Laba naik.' }]);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `pnpm vitest run tests/explain/hypotheses.test.ts`
Expected: FAIL karena modul `@/lib/explain/hypotheses` tidak ditemukan.

- [ ] **Step 3: Tambahkan kontrak di `lib/domain.ts`**

Sisipkan blok ini tepat sebelum baris `export interface Report {`:

```ts
/** Direction the AI expects news to push a sub-sector: a hypothesis about the mechanism, not a price forecast. */
export type ImpactDirection = 'negatif' | 'positif' | 'tidak jelas';

export interface SubSectorHypothesis {
  subSector: string;
  direction: ImpactDirection;
  reason: string;
}

```

Lalu di dalam `interface Report`, tepat setelah baris `analogs: AnalogSummary[];`, tambahkan:

```ts
  /** AI hypotheses on how the news affects each sub-sector. Absent on reports saved before 2026-10-04. */
  hypotheses?: SubSectorHypothesis[];
```

- [ ] **Step 4: Implementasi penyaringan**

Buat `lib/explain/hypotheses.ts`:

```ts
import type { ImpactDirection, SubSectorHypothesis } from '@/lib/domain';
import { findBannedPhrases } from './guard';

/** The AI's per-sub-sector impact hypotheses, safe to store and show: no advice wording, one per sub-sector. */
export function toReportHypotheses(
  hypotheses: { sub_sector: string; direction: ImpactDirection; reason: string }[],
): SubSectorHypothesis[] {
  const seen = new Set<string>();
  const out: SubSectorHypothesis[] = [];
  for (const h of hypotheses) {
    const reason = h.reason.trim();
    const key = h.sub_sector.toLowerCase();
    if (!reason || findBannedPhrases(reason).length > 0 || seen.has(key)) continue;
    seen.add(key);
    out.push({ subSector: h.sub_sector, direction: h.direction, reason });
  }
  return out;
}
```

Dugaan yang dibuang tidak menandai subsektornya sebagai "sudah dilihat", sehingga dugaan berikutnya yang layak untuk subsektor yang sama tetap dipakai. Test keempat mengunci perilaku ini.

- [ ] **Step 5: Jalankan test untuk memastikan lolos**

Run: `pnpm vitest run tests/explain/hypotheses.test.ts && pnpm typecheck`
Expected: 4 PASS, typecheck tanpa output.

- [ ] **Step 6: Commit**

```bash
git add lib/domain.ts lib/explain/hypotheses.ts tests/explain/hypotheses.test.ts
git commit -m "feat(explain): screen the AI's sub-sector impact hypotheses for reports"
```

---

### Task 2: Simpan dugaan AI di laporan

**Files:**
- Modify: `lib/pipeline/analyze.ts` (import, dan perakitan `const report: Report = { … }` sekitar baris 171)
- Test: `tests/pipeline/analyze.test.ts`

**Interfaces:**
- Consumes: `toReportHypotheses` dari Task 1; `profile.hypotheses` (bagian dari `EventProfile`) di `analyzeEvent`.
- Produces: setiap `Report` baru yang disimpan memuat `hypotheses: SubSectorHypothesis[]`.

- [ ] **Step 1: Tulis test yang gagal**

Di `tests/pipeline/analyze.test.ts`, ubah import repo menjadi `import { getEvent, getReport, insertEvent } from '@/lib/db/repo';`, lalu tambahkan dua test ini di dalam `describe('analyzeEvent', …)`, tepat setelah test `'produces a retrospective report with evidence and saves it'`:

```ts
  it('stores the AI impact hypotheses with the report', async () => {
    const { event } = await insertEvent(db, baseEvent);
    const report = await analyzeEvent(event.id, { db, market, llm: fakeLlm(), ledger: memoryLedger() });

    expect(report.hypotheses).toEqual([{ subSector: 'Banks', direction: 'negatif', reason: 'Uji.' }]);
    expect((await getReport(db, event.id))?.hypotheses).toEqual(report.hypotheses);
  });

  it('leaves out hypotheses whose reason reads as advice', async () => {
    const llm = fakeLlm({ ...PROFILE, hypotheses: [{ sub_sector: 'Banks', direction: 'negatif', reason: 'Jual saham bank sekarang.' }] });
    const { event } = await insertEvent(db, baseEvent);
    const report = await analyzeEvent(event.id, { db, market, llm, ledger: memoryLedger() });

    expect(report.hypotheses).toEqual([]);
  });
```

`PROFILE` di file ini sudah memuat `hypotheses: [{ sub_sector: 'Banks', direction: 'negatif', reason: 'Uji.' }]`, dan `Banks` ada di universe palsu.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `pnpm vitest run tests/pipeline/analyze.test.ts`
Expected: 2 test baru FAIL (`expected undefined to deeply equal [...]`), test lain lolos.

- [ ] **Step 3: Implementasi**

Di `lib/pipeline/analyze.ts`, tambahkan import:

```ts
import { toReportHypotheses } from '@/lib/explain/hypotheses';
```

Di dalam perakitan laporan `const report: Report = { … }` (sekitar baris 182), tepat setelah baris `      analogs,` milik objek itu, tambahkan baris berikut. Hati-hati: `      analogs,` juga muncul sekitar baris 165 di objek lain yang **bukan** `Report`; jangan sisipkan di sana.

```ts
      hypotheses: toReportHypotheses(profile.hypotheses),
```

- [ ] **Step 4: Jalankan test untuk memastikan lolos**

Run: `pnpm vitest run tests/pipeline/analyze.test.ts && pnpm typecheck`
Expected: semua PASS, typecheck tanpa output.

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/analyze.ts tests/pipeline/analyze.test.ts
git commit -m "feat(pipeline): keep the AI impact hypotheses in each report"
```

---

### Task 3: Fungsi murni untuk tabel dampak

**Files:**
- Create: `lib/ui/impact.ts`
- Modify: `lib/ui/present.ts` (tambahkan `tone`)
- Test: `tests/ui/impact.test.ts`, `tests/ui/present.test.ts`

**Interfaces:**
- Consumes: `ImpactDirection`, `Mode`, `Report` dari `@/lib/domain`; `describeVsMarket` dari `@/lib/ui/present`.
- Produces:
  - `tone(x: number): string` di `@/lib/ui/present`: `'text-down'` bila < 0, `'text-up'` bila > 0, selain itu `''`.
  - Dari `@/lib/ui/impact`:
    - `IMPACT_LABEL: Record<ImpactDirection, string>`
    - `IMPACT_TITLE`, `IMPACT_NOTE_AI`, `IMPACT_NOTE_PAST: string`
    - `interface ImpactRow { subSector: string; hypothesis: { direction: ImpactDirection; reason: string } | null; actual: { avgCar: number; count: number } | null; history: { eventCount: number; avgCar: number } | null }`
    - `buildImpactRows(report: Pick<Report, 'mode' | 'hypotheses' | 'subSectorSummary' | 'analogs'>): ImpactRow[]`
    - `impactColumns(rows: ImpactRow[], mode: Mode): { hypothesis: boolean; actual: boolean }`
    - `vsMarketPhrase(car: number): string`

- [ ] **Step 1: Tulis test yang gagal**

Buat `tests/ui/impact.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findBannedPhrases } from '@/lib/explain/guard';
import {
  IMPACT_LABEL,
  IMPACT_NOTE_AI,
  IMPACT_NOTE_PAST,
  IMPACT_TITLE,
  buildImpactRows,
  impactColumns,
  vsMarketPhrase,
} from '@/lib/ui/impact';

const base: Parameters<typeof buildImpactRows>[0] = { mode: 'retrospective', hypotheses: [], subSectorSummary: [], analogs: [] };

describe('buildImpactRows', () => {
  it('joins hypothesis, reaction and history for the same sub-sector, ignoring case', () => {
    const rows = buildImpactRows({
      ...base,
      hypotheses: [{ subSector: 'Banks', direction: 'negatif', reason: 'Porsi laba naik.' }],
      subSectorSummary: [{ subSector: 'banks', avgCar: -0.032, count: 4 }],
      analogs: [{ subSector: 'BANKS', eventCount: 3, avgCar: -0.021 }],
    });
    expect(rows).toEqual([
      {
        subSector: 'Banks',
        hypothesis: { direction: 'negatif', reason: 'Porsi laba naik.' },
        actual: { avgCar: -0.032, count: 4 },
        history: { eventCount: 3, avgCar: -0.021 },
      },
    ]);
  });

  it('lists hypotheses first, then measured reactions by stock count, then history only', () => {
    const rows = buildImpactRows({
      ...base,
      hypotheses: [{ subSector: 'Telecommunication', direction: 'positif', reason: 'Tarif turun.' }],
      subSectorSummary: [
        { subSector: 'Banks', avgCar: -0.01, count: 1 },
        { subSector: 'Insurance', avgCar: 0.01, count: 3 },
      ],
      analogs: [{ subSector: 'Utilities', eventCount: 2, avgCar: 0.004 }],
    });
    expect(rows.map((r) => r.subSector)).toEqual(['Telecommunication', 'Insurance', 'Banks', 'Utilities']);
  });

  it('never shows a measured reaction on a hypothesis report', () => {
    const rows = buildImpactRows({
      ...base,
      mode: 'prospective',
      subSectorSummary: [{ subSector: 'Banks', avgCar: -0.01, count: 2 }],
      analogs: [{ subSector: 'Banks', eventCount: 1, avgCar: -0.02 }],
    });
    expect(rows).toEqual([{ subSector: 'Banks', hypothesis: null, actual: null, history: { eventCount: 1, avgCar: -0.02 } }]);
  });

  it('works for reports saved before hypotheses existed', () => {
    const rows = buildImpactRows({ mode: 'retrospective', subSectorSummary: [{ subSector: 'Banks', avgCar: -0.05, count: 1 }], analogs: [] });
    expect(rows).toEqual([{ subSector: 'Banks', hypothesis: null, actual: { avgCar: -0.05, count: 1 }, history: null }]);
  });

  it('returns no rows when nothing is known', () => {
    expect(buildImpactRows(base)).toEqual([]);
  });
});

describe('impactColumns', () => {
  it('hides the AI column when no row has a hypothesis, and the reaction column on hypothesis reports', () => {
    const plain = buildImpactRows({ ...base, subSectorSummary: [{ subSector: 'Banks', avgCar: -0.05, count: 1 }] });
    expect(impactColumns(plain, 'retrospective')).toEqual({ hypothesis: false, actual: true });
    const guessed = buildImpactRows({ ...base, hypotheses: [{ subSector: 'Banks', direction: 'negatif', reason: 'Uji.' }] });
    expect(impactColumns(guessed, 'prospective')).toEqual({ hypothesis: true, actual: false });
  });
});

describe('vsMarketPhrase', () => {
  it('reads naturally, including when the move matches the market', () => {
    expect(vsMarketPhrase(-0.041)).toBe('turun 4,1% lebih dalam dari pasar');
    expect(vsMarketPhrase(0.015)).toBe('naik 1,5% lebih tinggi dari pasar');
    expect(vsMarketPhrase(0.0002)).toBe('sama dengan pasar');
  });
});

describe('impact copy', () => {
  it('words directions as impact, never as advice', () => {
    for (const text of [...Object.values(IMPACT_LABEL), IMPACT_TITLE, IMPACT_NOTE_AI, IMPACT_NOTE_PAST]) {
      expect(findBannedPhrases(text)).toEqual([]);
    }
  });
});
```

Di `tests/ui/present.test.ts`, tambahkan `tone` ke import dari `'@/lib/ui/present'`, lalu tambahkan di akhir file:

```ts
describe('tone', () => {
  it('colours a move by its sign', () => {
    expect(tone(-0.01)).toBe('text-down');
    expect(tone(0.01)).toBe('text-up');
    expect(tone(0)).toBe('');
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `pnpm vitest run tests/ui/impact.test.ts tests/ui/present.test.ts`
Expected: FAIL. `@/lib/ui/impact` belum ada, dan `tone` belum diekspor dari `@/lib/ui/present`.

- [ ] **Step 3: Implementasi**

Di `lib/ui/present.ts`, tambahkan setelah fungsi `describeVsMarket`:

```ts
/** Text colour for a move relative to the market: red below, green above, plain when flat. */
export function tone(x: number): string {
  return x < 0 ? 'text-down' : x > 0 ? 'text-up' : '';
}
```

Buat `lib/ui/impact.ts`:

```ts
import type { ImpactDirection, Mode, Report } from '@/lib/domain';
import { describeVsMarket } from './present';

export const IMPACT_LABEL: Record<ImpactDirection, string> = {
  negatif: 'Tekanan',
  positif: 'Dorongan',
  'tidak jelas': 'Belum jelas',
};
export const IMPACT_TITLE = 'Dampak per bidang usaha';
export const IMPACT_NOTE_AI = 'Dugaan AI disusun dari isi berita, bukan perkiraan harga.';
export const IMPACT_NOTE_PAST = 'Masa lalu tidak menjamin gerak berikutnya.';

export interface ImpactRow {
  subSector: string;
  hypothesis: { direction: ImpactDirection; reason: string } | null;
  actual: { avgCar: number; count: number } | null;
  history: { eventCount: number; avgCar: number } | null;
}

/**
 * One row per sub-sector, joining the AI hypothesis, the measured reaction and similar past news.
 * Hypotheses come first in the AI's order, then measured reactions by stock count, then history only.
 */
export function buildImpactRows(report: Pick<Report, 'mode' | 'hypotheses' | 'subSectorSummary' | 'analogs'>): ImpactRow[] {
  const rows = new Map<string, ImpactRow>();
  const row = (name: string): ImpactRow => {
    const key = name.toLowerCase();
    let r = rows.get(key);
    if (!r) {
      r = { subSector: name, hypothesis: null, actual: null, history: null };
      rows.set(key, r);
    }
    return r;
  };
  for (const h of report.hypotheses ?? []) row(h.subSector).hypothesis = { direction: h.direction, reason: h.reason };
  if (report.mode === 'retrospective') {
    for (const s of [...report.subSectorSummary].sort((a, b) => b.count - a.count)) {
      row(s.subSector).actual = { avgCar: s.avgCar, count: s.count };
    }
  }
  for (const a of report.analogs) row(a.subSector).history = { eventCount: a.eventCount, avgCar: a.avgCar };
  return [...rows.values()];
}

/** Which optional columns to show: the AI column only when some row has a hypothesis, the reaction column only after the fact. */
export function impactColumns(rows: ImpactRow[], mode: Mode): { hypothesis: boolean; actual: boolean } {
  return { hypothesis: rows.some((r) => r.hypothesis !== null), actual: mode === 'retrospective' };
}

/** "turun 4,1% lebih dalam dari pasar", or "sama dengan pasar" when the move rounds to zero. */
export function vsMarketPhrase(car: number): string {
  const text = describeVsMarket(car);
  return text === 'Sama dengan pasar' ? 'sama dengan pasar' : `${text.toLowerCase()} dari pasar`;
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lolos**

Run: `pnpm vitest run tests/ui/impact.test.ts tests/ui/present.test.ts && pnpm typecheck`
Expected: semua PASS (9 test baru), typecheck tanpa output.

- [ ] **Step 5: Commit**

```bash
git add lib/ui/impact.ts lib/ui/present.ts tests/ui/impact.test.ts tests/ui/present.test.ts
git commit -m "feat(ui): helpers to join AI hypotheses, reactions and past news per sub-sector"
```

---

### Task 4: Komponen `ImpactTable` dan penempatannya di laporan

**Files:**
- Create: `components/ImpactTable.tsx`
- Modify: `components/ReportView.tsx` (import, hapus `tone` lokal di baris 14, sisipkan blok HIPOTESIS setelah strip ringkasan, ganti dua kolom bawah)
- Test: `e2e/analyze.spec.ts`

**Interfaces:**
- Consumes: semua hasil Task 3, dan `Report` dari `@/lib/domain`.
- Produces: `ImpactTable({ report }: { report: Report })`, yang merender `<section id="dampak">`.

- [ ] **Step 1: Tulis assertion e2e yang gagal**

Di `e2e/analyze.spec.ts`, pada test pertama (`pasted text produces a retrospective report with evidence and disclaimer`), sisipkan blok ini tepat setelah baris `await expect(page.locator('body')).not.toContainText(/kuota/i);` yang **pertama**, yaitu yang masih berada di halaman laporan:

```ts
  // The AI's guess sits beside what the market actually did, per sub-sector.
  const impact = page.locator('#dampak');
  await expect(impact.getByText('Banks', { exact: true })).toBeVisible();
  await expect(impact.getByText('TEKANAN', { exact: true })).toBeVisible();
  await expect(impact.getByText('(Contoh) Ketidakpastian kebijakan.')).toBeVisible();
  await expect(impact.getByText('Kenyataan', { exact: true })).toBeVisible();
  // Columns must really form: Tailwind drops class names that are assembled from fragments.
  const header = impact.locator('[data-impact-header]');
  const columns = await header.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(4);
```

Lalu tambahkan test baru ini **di akhir file**. Letaknya harus terakhir, karena laporan bertanggal 2099 akan menjadi kartu teratas di beranda dan mengganggu test beranda yang lain:

```ts
test('a hypothesis report leads with the impact table and shows no measured reaction', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('Tautan atau isi berita')
    .fill(
      'Pemerintah berencana mengubah aturan dividen bank milik negara mulai tahun depan. Pelaku pasar menunggu rincian kebijakan tersebut sebelum menilai dampaknya.',
    );
  // A future date keeps this deterministic: the fake IHSG series covers every weekday up to today,
  // so an undated article tested on a weekday before 16:00 WIB would turn out retrospective.
  await page.getByLabel('Tanggal berita (opsional)').fill('2099-01-05');
  await page.getByRole('button', { name: 'Cek dampak berita' }).click();

  await expect(page).toHaveURL(/\/events\//, { timeout: 30_000 });
  const impact = page.locator('#dampak');
  await expect(impact).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/HIPOTESIS/).first()).toBeVisible();
  await expect(impact.getByText('TEKANAN', { exact: true })).toBeVisible();
  await expect(impact.getByText('Kenyataan', { exact: true })).toHaveCount(0);

  const tableTop = (await impact.boundingBox())!.y;
  const stocksTop = (await page.getByRole('heading', { name: 'Saham yang terkait dengan berita ini' }).boundingBox())!.y;
  expect(tableTop).toBeLessThan(stocksTop);
});
```

- [ ] **Step 2: Jalankan e2e untuk memastikan gagal**

Run: `pnpm e2e`
Expected: test pertama FAIL di `#dampak … Banks` karena elemennya belum ada, dan test HIPOTESIS baru FAIL di `#dampak toBeVisible`. Test lain lolos. Kalau ada server dev yang masih berjalan di port 3100, matikan dulu (`reuseExistingServer`).

- [ ] **Step 3: Buat komponen**

Buat `components/ImpactTable.tsx`:

```tsx
import type { Report } from '@/lib/domain';
import { IMPACT_LABEL, IMPACT_NOTE_AI, IMPACT_NOTE_PAST, IMPACT_TITLE, buildImpactRows, impactColumns, vsMarketPhrase } from '@/lib/ui/impact';
import { tone } from '@/lib/ui/present';

// Whole class names only: Tailwind never generates a class assembled from fragments.
const GRID = {
  'hyp-act': 'md:grid-cols-[150px_minmax(0,1fr)_200px_200px]',
  'hyp-pro': 'md:grid-cols-[150px_minmax(0,1fr)_220px]',
  'act-only': 'md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)]',
  'history-only': 'md:grid-cols-[150px_minmax(0,1fr)]',
} as const;

/** Per-sub-sector impact: the AI's hypothesis beside the measured reaction and similar past news. */
export function ImpactTable({ report }: { report: Report }) {
  const rows = buildImpactRows(report);
  const cols = impactColumns(rows, report.mode);
  const grid = `grid gap-x-4 gap-y-1.5 ${GRID[cols.hypothesis ? (cols.actual ? 'hyp-act' : 'hyp-pro') : cols.actual ? 'act-only' : 'history-only']}`;

  return (
    <section id="dampak" aria-labelledby="dampak-judul" className="flex flex-col gap-4">
      <h3 id="dampak-judul" className="text-[17px]">
        {IMPACT_TITLE}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-white/50">Belum ada data per bidang usaha.</p>
      ) : (
        <div className="border border-line">
          <div data-impact-header className={`${grid} hidden border-b border-line px-4 py-3 text-xs text-white/55 md:grid`} aria-hidden="true">
            <span>Bidang usaha</span>
            {cols.hypothesis && <span>Dugaan AI</span>}
            {cols.actual && <span>Kenyataan</span>}
            <span>Berita serupa sebelumnya</span>
          </div>
          {rows.map((r) => (
            <div key={r.subSector} className={`${grid} border-b border-line px-4 py-3.5 text-sm last:border-b-0`}>
              <span className="font-medium">{r.subSector}</span>
              {cols.hypothesis && (
                <span className="leading-relaxed text-white/80">
                  <span className="text-white/45 md:hidden">Dugaan AI: </span>
                  {r.hypothesis ? (
                    <>
                      <span className="mr-2 inline-block border border-dashed border-hypo/70 px-1.5 py-0.5 font-mono text-[11px] tracking-wide text-hypo">
                        {IMPACT_LABEL[r.hypothesis.direction].toUpperCase()}
                      </span>
                      {r.hypothesis.reason}
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              )}
              {cols.actual && (
                <span className={r.actual ? tone(r.actual.avgCar) : 'text-white/50'}>
                  <span className="text-white/45 md:hidden">Kenyataan: </span>
                  {r.actual ? `${vsMarketPhrase(r.actual.avgCar)} · ${r.actual.count} saham` : '—'}
                </span>
              )}
              <span className="text-white/75">
                <span className="text-white/45 md:hidden">Berita serupa: </span>
                {r.history ? (
                  <>
                    {r.history.eventCount} berita · rata-rata <span className={tone(r.history.avgCar)}>{vsMarketPhrase(r.history.avgCar)}</span>
                  </>
                ) : (
                  'Belum ada'
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-white/45">{cols.hypothesis ? `${IMPACT_NOTE_AI} ${IMPACT_NOTE_PAST}` : IMPACT_NOTE_PAST}</p>
    </section>
  );
}
```

- [ ] **Step 4: Pasang di `ReportView`**

Di `components/ReportView.tsx`:

(a) Ubah baris import `present` menjadi:

```ts
import { SHORT_DISCLAIMER, describeVsMarket, foreignFlowText, formatDateId, tone, unusualLabel } from '@/lib/ui/present';
```

lalu tambahkan import komponen di bawahnya:

```ts
import { ImpactTable } from './ImpactTable';
```

dan **hapus** baris lokal `const tone = (x: number) => (x < 0 ? 'text-down' : x > 0 ? 'text-up' : '');`.

(b) Laporan HIPOTESIS: ganti teks ini

```tsx
      </section>

      <section className="grid border-b border-line lg:grid-cols-[minmax(0,1fr)_380px]">
```

menjadi

```tsx
      </section>

      {!retro && (
        <section className="border-b border-line py-10">
          <ImpactTable report={report} />
        </section>
      )}

      <section className="grid border-b border-line lg:grid-cols-[minmax(0,1fr)_380px]">
```

(c) Bagian bawah: ganti seluruh blok mulai `<section className="grid border-b border-line md:grid-cols-3">` sampai dan **termasuk** baris pembuka `<div className="flex flex-col gap-3 py-8 md:pl-8">` (yaitu kolom "Per bidang usaha", kolom "Berita serupa sebelumnya", dan pembuka kolom "Turun tajam") dengan:

```tsx
      <section className={`grid border-b border-line ${retro ? 'md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}>
        {retro && (
          <div className="border-line py-8 max-md:border-b md:border-r md:pr-8">
            <ImpactTable report={report} />
          </div>
        )}
        <div className={`flex flex-col gap-3 py-8 ${retro ? 'md:pl-8' : ''}`}>
```

Isi kolom "Turun tajam, belum ada penjelasan" setelah baris itu tidak berubah. Kedua string kelas di atas ditulis utuh, jadi Tailwind men-generate keduanya.

- [ ] **Step 5: Jalankan e2e untuk memastikan lolos**

Run: `pnpm e2e`
Expected: 6 passed.

- [ ] **Step 6: Jalankan seluruh pemeriksaan**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: 301 test lolos (286 + 4 + 2 + 9), typecheck tanpa output, lint 0 error (3 warning lama dibiarkan), build sukses.

- [ ] **Step 7: Cek tampilan di localhost tanpa kredit**

Run: `SECTORS_MODE=fake LLM_MODE=fake pnpm dev`. Di beranda, klik salah satu kartu di bagian "Laporan terbaru" (semuanya laporan lama dari `local.db`). Expected: tabel "Dampak per bidang usaha" tampil **tanpa** kolom "Dugaan AI", karena laporan lama belum punya dugaan. Hentikan server setelah selesai.

- [ ] **Step 8: Commit**

```bash
git add components/ImpactTable.tsx components/ReportView.tsx e2e/analyze.spec.ts
git commit -m "feat(ui): impact table with the AI's guess beside the real reaction"
```

---

### Task 5: Dokumentasi dan rilis

**Files:**
- Modify: `HANDOFF.md` (baris Step 6 di §1)

**Interfaces:**
- Consumes: semua commit Task 1–4.
- Produces: produksi menampilkan tabel dampak.

- [ ] **Step 1: Perbarui HANDOFF**

Di `HANDOFF.md` §1 baris Step 6, sebelum `|` penutup baris, tambahkan kalimat: "Laporan menyimpan dugaan mekanisme dampak dari AI per subsektor (`Report.hypotheses`, sejak 4 Okt) dan menampilkannya di tabel 'Dampak per bidang usaha' bersama reaksi nyata dan pola historis. Bukan prediksi harga; laporan lama tampil tanpa kolom dugaan."

```bash
git add HANDOFF.md
git commit -m "docs(handoff): record the impact table and stored AI hypotheses"
```

- [ ] **Step 2: Merge dan push**

Ini aksi ke branch bersama yang memicu deploy produksi, jadi **wajib minta izin manusia dulu**. Setelah disetujui, periksa `git fetch origin && git log main..origin/main` untuk memastikan tidak ada commit baru, lalu:

```bash
git checkout main && git merge --ff-only feat/impact-table && git push origin main
```

- [ ] **Step 3: Verifikasi produksi**

Tunggu CI hijau (`test` dan `e2e`) dan deploy Vercel. Halaman laporan dirender di browser dari `/api/events/:id`, jadi `curl` atas HTML-nya tidak membuktikan apa pun. Periksa lewat data:

```bash
curl -s https://correlation-explainer-idx.vercel.app/api/events/edf7432c-b598-41d2-a8d1-39062793621c | python -c "import sys,json; r=json.load(sys.stdin)['report']; print('hypotheses' in r)"
```

(`edf7432c-…` adalah laporan "IDX Implements Short Selling…", dibuat 3 Okt sebelum fitur ini ada.)

Expected: `False` untuk laporan lama, dan halamannya tetap terbuka normal di browser dengan tabel tanpa kolom dugaan. Laporan baru pertama yang memuat dugaan AI akan berasal dari analisis berikutnya, misalnya run otomatis Senin pukul 08:00 WIB.
