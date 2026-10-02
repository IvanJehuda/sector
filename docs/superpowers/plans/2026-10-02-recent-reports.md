# Laporan Terbaru di Beranda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Laporan yang sudah selesai dianalisis tetap terlihat di beranda, walaupun polling terus memasukkan berita baru.

**Architecture:** Feed beranda sekarang memuat 30 event terbaru menurut `published_at` tanpa melihat status (`listEvents` di `lib/db/repo.ts`), jadi berita hasil polling mendorong laporan jadi keluar dari daftar. Solusinya: satu query baru untuk event berstatus `done`, satu bagian beranda baru ("Laporan terbaru") di antara "Cara kerja" dan "Berita terbaru", dan feed yang tidak lagi mengulang event yang sudah tampil di bagian itu. Logika tampilan dipisah ke fungsi murni (`lib/ui/home.ts`) supaya bisa dites unit, karena Vitest proyek ini berjalan di lingkungan `node` tanpa test komponen. Komponennya dikunci lewat e2e.

**Tech Stack:** Next.js 15 (App Router, server components), TypeScript, libSQL, Tailwind v4, Vitest, Playwright.

**Spec:** Desain bounded yang disetujui di chat pada 2 Okt 2026 (tanpa file spec). Isinya: `listDoneEvents(db, limit = 6)`; komponen `RecentReports` dengan maksimal 6 kartu (tanggal, judul, sampai 4 kode saham, "Lihat laporan →"), disembunyikan bila kosong, gayanya mengikuti `Feed`; ditaruh di antara `HowItWorks` dan `Feed`; laporan yang sudah tampil di sana dikeluarkan dari feed; ticker berita tidak diubah; tanpa kredit; rilis lewat push ke `main` (auto-deploy Vercel) lalu verifikasi produksi.

## Global Constraints

- "JANGAN memanggil API Sectors asli dari test atau saat eksperimen." Pekerjaan ini **tidak memakai kredit Sectors maupun OpenAI**. Jangan jalankan `pnpm dev` dengan `SECTORS_MODE=live` atau `LLM_MODE=openai`; untuk melihat UI pakai `SECTORS_MODE=fake LLM_MODE=fake`.
- "`lib/domain.ts` adalah kontrak antar modul. Jangan mengubahnya tanpa persetujuan tim." Tidak ada task yang menyentuhnya.
- "Tidak boleh ada saran investasi. Teks yang ditampilkan ke user wajib lolos `findBannedPhrases()` (lib/explain/guard.ts)." Kata terlarang mencakup `beli`, `jual`, `rekomendasi`, `target harga`, `buy`, `sell`, `hold`.
- "Modul kecil dengan satu tanggung jawab. Fungsi murni diletakkan di `lib/market`, `lib/explain`, dan `lib/history`." Fungsi murni untuk UI mengikuti pola yang sudah ada di `lib/ui/` (`labels.ts`, `present.ts`).
- "TDD: tulis test dulu. Sebelum menyatakan selesai, jalankan `pnpm test && pnpm typecheck` dan tunjukkan hasilnya."
- "Teks UI dalam Bahasa Indonesia. Kode dan identifier dalam bahasa Inggris."
- "Jangan commit `.env*`, `*.db`, atau API key."
- Akhiri setiap pesan commit dengan baris `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Belum ada laporan jadi sama sekali** (database baru, atau deploy pertama sebelum ada analisis) → bagian "Laporan terbaru" tidak boleh tampil sebagai judul kosong. Dikunci di Task 3 lewat e2e: beranda yang masih kosong tidak memuat `#laporan`.
2. **Laporan jadi yang juga termasuk 30 berita terbaru** (misalnya berita hari ini yang baru dianalisis pengunjung) → tidak boleh muncul dua kali di satu halaman. Dikunci di Task 2 (`excludeShown`) dan Task 3 (e2e: judulnya ada di `#laporan`, tidak ada di `#berita`).
3. **Event selesai tanpa kode saham**, misalnya berita tempelan manual yang `symbols`-nya kosong → kartu menampilkan `—`, bukan baris kosong; dan event dengan banyak saham tidak melebarkan kartu. Dikunci di Task 2 (`symbolsLabel`).
4. **Lebih dari 6 laporan jadi** → hanya 6 terbaru yang tampil, urut terbaru dulu, dan event berstatus `new`, `analyzing`, atau `failed` tidak pernah ikut. Dikunci di Task 1.
5. **Teks baru di bagian ini** → wajib lolos `findBannedPhrases()` sesuai aturan 4. Dikunci di Task 2 dengan test atas konstanta teksnya.

---

### Task 1: Query `listDoneEvents`

**Files:**
- Modify: `lib/db/repo.ts` (tambahkan fungsi tepat setelah `listEvents`, sekitar baris 63–66)
- Test: `tests/db/repo.test.ts`

**Interfaces:**
- Consumes: `rowToEvent(r: Row): StoredEvent` (privat, sudah ada di `lib/db/repo.ts:6`), `insertEvent`, `setEventStatus` (sudah ada).
- Produces: `listDoneEvents(db: Db, limit?: number): Promise<StoredEvent[]>`. Default `limit` = 6, hanya `status = 'done'`, urut `published_at DESC`.

- [ ] **Step 1: Tulis test yang gagal**

Di `tests/db/repo.test.ts`, tambahkan `listDoneEvents` ke daftar import dari `'@/lib/db/repo'` (urutan alfabetis, setelah `listEvents`), lalu tambahkan blok ini di akhir file:

```ts
describe('listDoneEvents', () => {
  const add = (n: number, day: string) =>
    insertEvent(db, { ...input, url: `https://example.com/done-${n}`, publishedAt: `2026-09-${day}T10:00:00` });

  it('returns only finished events, newest first, up to the limit', async () => {
    const a = (await add(1, '01')).event;
    const b = (await add(2, '03')).event;
    const c = (await add(3, '02')).event;
    await add(4, '05'); // stays 'new'
    const failed = (await add(5, '06')).event;
    const analyzing = (await add(6, '07')).event;
    for (const e of [a, b, c]) await setEventStatus(db, e.id, 'done');
    await setEventStatus(db, failed.id, 'failed', 'Gagal');
    await setEventStatus(db, analyzing.id, 'analyzing');

    expect((await listDoneEvents(db)).map((e) => e.id)).toEqual([b.id, c.id, a.id]);
    expect((await listDoneEvents(db, 2)).map((e) => e.id)).toEqual([b.id, c.id]);
  });

  it('defaults to six', async () => {
    for (let i = 10; i < 18; i++) {
      const { event } = await add(i, String(i));
      await setEventStatus(db, event.id, 'done');
    }
    expect(await listDoneEvents(db)).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `pnpm vitest run tests/db/repo.test.ts`
Expected: FAIL. TypeScript/Vitest melaporkan bahwa `listDoneEvents` tidak diekspor oleh `@/lib/db/repo` (atau `listDoneEvents is not a function`).

- [ ] **Step 3: Implementasi minimal**

Di `lib/db/repo.ts`, tepat setelah fungsi `listEvents`:

```ts
/** Most recent finished analyses, newest first. Kept separate from the feed so new news cannot push them out. */
export async function listDoneEvents(db: Db, limit = 6): Promise<StoredEvent[]> {
  const r = await db.execute({
    sql: "SELECT * FROM events WHERE status = 'done' ORDER BY published_at DESC LIMIT ?",
    args: [limit],
  });
  return r.rows.map(rowToEvent);
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lolos**

Run: `pnpm vitest run tests/db/repo.test.ts`
Expected: PASS, termasuk 2 test baru.

- [ ] **Step 5: Commit**

```bash
git add lib/db/repo.ts tests/db/repo.test.ts
git commit -m "feat(db): list finished events for the homepage"
```

---

### Task 2: Fungsi murni untuk beranda

**Files:**
- Create: `lib/ui/home.ts`
- Test: `tests/ui/home.test.ts`

**Interfaces:**
- Consumes: tipe `StoredEvent` dari `@/lib/domain`; `findBannedPhrases` dari `@/lib/explain/guard` (hanya di test).
- Produces:
  - `RECENT_REPORTS_LABEL: string` = `'// LAPORAN TERBARU //'`
  - `RECENT_REPORTS_TITLE: string` = `'Berita yang sudah dianalisis'`
  - `RECENT_REPORTS_LINK: string` = `'Lihat laporan'`
  - `excludeShown(events: StoredEvent[], shown: StoredEvent[]): StoredEvent[]` — membuang event yang id-nya ada di `shown`, urutan dipertahankan.
  - `symbolsLabel(symbols: string[], max?: number): string` — default `max` = 4. `[]` → `'—'`; sampai `max` → digabung dengan `' · '`; lebih dari `max` → `max` pertama digabung lalu `' +N'`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `tests/ui/home.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { StoredEvent } from '@/lib/domain';
import { findBannedPhrases } from '@/lib/explain/guard';
import {
  RECENT_REPORTS_LABEL,
  RECENT_REPORTS_LINK,
  RECENT_REPORTS_TITLE,
  excludeShown,
  symbolsLabel,
} from '@/lib/ui/home';

function event(id: string): StoredEvent {
  return {
    id,
    source: 'feed',
    url: `https://example.com/${id}`,
    title: `Berita ${id}`,
    body: 'Isi berita',
    publishedAt: '2026-10-02T08:00:00',
    symbols: [],
    tags: [],
    subSectors: [],
    status: 'new',
    statusMessage: null,
    createdAt: '2026-10-02T08:00:00.000Z',
    statusUpdatedAt: null,
  };
}

describe('excludeShown', () => {
  it('drops events already shown elsewhere and keeps the feed order', () => {
    const feed = [event('a'), event('b'), event('c'), event('d')];
    expect(excludeShown(feed, [event('c'), event('a')]).map((e) => e.id)).toEqual(['b', 'd']);
  });

  it('returns the feed unchanged when nothing is shown', () => {
    const feed = [event('a'), event('b')];
    expect(excludeShown(feed, []).map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('symbolsLabel', () => {
  it('shows a dash when the event has no symbols', () => {
    expect(symbolsLabel([])).toBe('—');
  });

  it('joins up to four symbols', () => {
    expect(symbolsLabel(['BBRI', 'BMRI'])).toBe('BBRI · BMRI');
    expect(symbolsLabel(['BBRI', 'BMRI', 'BBNI', 'BRIS'])).toBe('BBRI · BMRI · BBNI · BRIS');
  });

  it('counts the symbols it leaves out', () => {
    expect(symbolsLabel(['LSIP', 'SIMP', 'INDF', 'AUTO', 'AALI', 'UNTR'])).toBe('LSIP · SIMP · INDF · AUTO +2');
    expect(symbolsLabel(['A', 'B', 'C'], 2)).toBe('A · B +1');
  });
});

describe('recent reports copy', () => {
  it('stays clear of investment-advice wording', () => {
    for (const text of [RECENT_REPORTS_LABEL, RECENT_REPORTS_TITLE, RECENT_REPORTS_LINK]) {
      expect(findBannedPhrases(text)).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `pnpm vitest run tests/ui/home.test.ts`
Expected: FAIL karena modul `@/lib/ui/home` belum ada.

- [ ] **Step 3: Implementasi minimal**

Buat `lib/ui/home.ts`:

```ts
import type { StoredEvent } from '@/lib/domain';

export const RECENT_REPORTS_LABEL = '// LAPORAN TERBARU //';
export const RECENT_REPORTS_TITLE = 'Berita yang sudah dianalisis';
export const RECENT_REPORTS_LINK = 'Lihat laporan';

/** Drops events already shown elsewhere on the page, keeping the original order. */
export function excludeShown(events: StoredEvent[], shown: StoredEvent[]): StoredEvent[] {
  const ids = new Set(shown.map((e) => e.id));
  return events.filter((e) => !ids.has(e.id));
}

/** Short ticker list for a card: a dash when empty, and a count of what does not fit. */
export function symbolsLabel(symbols: string[], max = 4): string {
  if (symbols.length === 0) return '—';
  const shown = symbols.slice(0, max).join(' · ');
  const rest = symbols.length - max;
  return rest > 0 ? `${shown} +${rest}` : shown;
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lolos**

Run: `pnpm vitest run tests/ui/home.test.ts`
Expected: PASS, 6 test.

- [ ] **Step 5: Commit**

```bash
git add lib/ui/home.ts tests/ui/home.test.ts
git commit -m "feat(ui): helpers for the recent reports section"
```

---

### Task 3: Komponen `RecentReports` dan pemasangannya di beranda

**Files:**
- Create: `components/RecentReports.tsx`
- Modify: `app/page.tsx` (seluruh fungsi `Home`, baris 11–38)
- Test: `e2e/analyze.spec.ts` (test pertama, `pasted text produces a retrospective report with evidence and disclaimer`)

**Interfaces:**
- Consumes: `listDoneEvents(db, limit?)` dari Task 1; `RECENT_REPORTS_LABEL`, `RECENT_REPORTS_TITLE`, `RECENT_REPORTS_LINK`, `excludeShown`, `symbolsLabel` dari Task 2; `formatDateId` dari `@/lib/ui/present`; `Container` dari `./SiteNav`; `listEvents`, `getDb` (sudah ada).
- Produces: `RecentReports({ events }: { events: StoredEvent[] })`, sebuah server component yang merender `<section id="laporan">` atau `null` bila `events` kosong.

- [ ] **Step 1: Tulis assertion e2e yang gagal**

Di `e2e/analyze.spec.ts`, ubah test pertama menjadi seperti ini. Assertion lama tetap utuh; yang baru adalah baris kedua dan blok di akhir:

```ts
test('pasted text produces a retrospective report with evidence and disclaimer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#laporan')).toHaveCount(0);
  await page
    .getByLabel('Tautan atau isi berita')
    .fill(
      'Presiden menyampaikan pidato tentang rencana pengelolaan BUMN melalui badan investasi baru. Pelaku pasar menanggapi rencana tersebut dengan hati-hati, terutama pada saham bank milik negara.',
    );
  await page.getByLabel('Tanggal berita (opsional)').fill('2026-03-02');
  await page.getByRole('button', { name: 'Cek dampak berita' }).click();

  await expect(page).toHaveURL(/\/events\//, { timeout: 30_000 });
  await expect(page.getByText('bukan saran investasi').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Retrospektif')).toBeVisible();
  await expect(page.getByText('PT Bank Rakyat Indonesia (Persero) Tbk').first()).toBeVisible();

  // The finished report now stays on the homepage, once, in its own section.
  const title = 'Presiden menyampaikan pidato tentang rencana pengelolaan BUMN melalui badan investasi baru.';
  await page.goto('/');
  await expect(page.locator('#laporan').getByText(title)).toBeVisible();
  await expect(page.locator('#berita').getByText(title)).toHaveCount(0);
});
```

Judul event berasal dari kalimat pertama teks tempelan (`firstSentence` di `lib/events/manual.ts`), jadi string di atas adalah judul yang tersimpan.

- [ ] **Step 2: Jalankan e2e untuk memastikan gagal**

Run: `pnpm e2e`
Expected: test pertama FAIL pada `#laporan ... toBeVisible()` karena bagian itu belum ada. Dua test lain tetap lolos. Kalau di laptop sudah ada server dev di port 3100, hentikan dulu: config memakai `reuseExistingServer` di luar CI, jadi server lama tidak menghapus `e2e.db`.

- [ ] **Step 3: Buat komponen**

Buat `components/RecentReports.tsx`:

```tsx
import Link from 'next/link';
import type { StoredEvent } from '@/lib/domain';
import { RECENT_REPORTS_LABEL, RECENT_REPORTS_LINK, RECENT_REPORTS_TITLE, symbolsLabel } from '@/lib/ui/home';
import { formatDateId } from '@/lib/ui/present';
import { Container } from './SiteNav';

/** Finished reports, kept on the homepage so newly polled news cannot push them out of sight. */
export function RecentReports({ events }: { events: StoredEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section id="laporan" aria-labelledby="laporan-judul" className="scroll-mt-20 border-b border-line pt-16 pb-14">
      <Container className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <span className="font-mono text-xs tracking-widest text-white/80">{RECENT_REPORTS_LABEL}</span>
          <h2 id="laporan-judul" className="text-3xl font-light sm:text-4xl">
            {RECENT_REPORTS_TITLE}
          </h2>
        </div>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.id}`}
                className="group flex h-full flex-col gap-3 border border-line bg-white/[0.02] p-5 transition-colors hover:border-amber/60 hover:bg-white/[0.045]"
              >
                <span className="font-mono text-[13px] text-white/60">{formatDateId(e.publishedAt)}</span>
                <span className="line-clamp-3 text-[15px] leading-snug">{e.title}</span>
                <span className="mt-auto font-mono text-[13px] text-white/80">{symbolsLabel(e.symbols)}</span>
                <span className="text-sm text-white/80 group-hover:text-amber">
                  {RECENT_REPORTS_LINK} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
```

- [ ] **Step 4: Pasang di beranda**

Ganti seluruh isi `app/page.tsx` dengan ini. Dibanding versi sekarang, yang berubah hanya tiga import baru, cara mengambil data di awal `Home`, dan dua baris di dalam `<main>`. `SiteNav` dan `<NewsTicker events={events} />` tetap sama; ticker sengaja tetap menampilkan semua berita terbaru.

```tsx
import { CreditBanner, CreditPill } from '@/components/CreditBanner';
import { Feed } from '@/components/Feed';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { NewsTicker } from '@/components/NewsTicker';
import { RecentReports } from '@/components/RecentReports';
import { Container, Frame, SiteFooter, SiteNav } from '@/components/SiteNav';
import { getDb } from '@/lib/db/client';
import { listDoneEvents, listEvents } from '@/lib/db/repo';
import { excludeShown } from '@/lib/ui/home';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const db = await getDb();
  const [events, reports] = await Promise.all([listEvents(db, 30), listDoneEvents(db, 6)]);
  return (
    <Frame>
      <SiteNav>
        <div className="hidden gap-8 text-sm text-white/70 lg:flex">
          <a href="#cara-kerja" className="hover:text-fg">
            Cara kerja
          </a>
          <a href="#berita" className="hover:text-fg">
            Berita terbaru
          </a>
        </div>
        <CreditPill />
      </SiteNav>
      <NewsTicker events={events} />
      <main className="flex-1">
        <Container className="pt-4 empty:hidden">
          <CreditBanner />
        </Container>
        <Hero />
        <div className="spectral-line" />
        <HowItWorks />
        <RecentReports events={reports} />
        <Feed events={excludeShown(events, reports)} />
      </main>
      <SiteFooter />
    </Frame>
  );
}
```

- [ ] **Step 5: Jalankan e2e untuk memastikan lolos**

Run: `pnpm e2e`
Expected: 3 passed.

- [ ] **Step 6: Jalankan seluruh pemeriksaan**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: semua test lolos (262 sebelumnya + 2 dari Task 1 + 6 dari Task 2 = 270), typecheck tanpa output, lint 0 error (3 warning lama tentang `_args`/`_url`/`_init` dibiarkan), build sukses.

- [ ] **Step 7: Cek tampilan di localhost tanpa kredit**

Run: `SECTORS_MODE=fake LLM_MODE=fake pnpm dev`, buka `http://localhost:3000`. Database lokal (`local.db`) berisi 12 laporan jadi, jadi bagian "Berita yang sudah dianalisis" harus tampil dengan 6 kartu, di antara "Cara kerja" dan "Berita terbaru". Periksa juga lebar ponsel (sekitar 375px): kartu harus tersusun satu kolom tanpa scroll horizontal. Hentikan server setelah selesai.

- [ ] **Step 8: Commit**

```bash
git add components/RecentReports.tsx app/page.tsx e2e/analyze.spec.ts
git commit -m "feat(ui): keep finished reports on the homepage"
```

---

### Task 4: Rilis ke produksi

**Files:**
- Modify: `HANDOFF.md` (baris Step 6 di tabel §1: hapus catatan bahwa laporan terdorong keluar dari beranda)

**Interfaces:**
- Consumes: semua commit Task 1–3 di `main`.
- Produces: produksi `https://correlation-explainer-idx.vercel.app` menampilkan bagian "Laporan terbaru".

- [ ] **Step 1: Perbarui HANDOFF**

Di `HANDOFF.md` §1, baris Step 6, ganti kalimat "Catatan: feed beranda menampilkan 30 berita terbaru, sehingga berita baru dari polling mendorong 12 laporan jadi keluar dari beranda (laporannya tetap bisa dibuka lewat tautan langsung)" dengan "Beranda punya bagian 'Laporan terbaru' (6 laporan jadi terbaru), jadi berita baru dari polling tidak lagi menyembunyikan laporan jadi".

```bash
git add HANDOFF.md
git commit -m "docs(handoff): recent reports section replaces the buried-report note"
```

- [ ] **Step 2: Push ke `main`**

Push ke `main` memicu auto-deploy Vercel. Ini aksi ke branch bersama, jadi **harus disetujui manusia lebih dulu**.

```bash
git push origin main
```

- [ ] **Step 3: Verifikasi CI dan produksi**

Tunggu CI hijau (`test` dan `e2e`) untuk commit terakhir, lalu tunggu deploy Vercel selesai (1–3 menit). Lalu:

```bash
curl -s https://correlation-explainer-idx.vercel.app/ -o /tmp/home.html
grep -c 'Berita yang sudah dianalisis' /tmp/home.html
grep -o 'Lihat laporan' /tmp/home.html | wc -l
```

Expected: baris pertama `1` atau lebih. Baris kedua `6`, karena 6 laporan jadi tampil di bagian baru, sementara 6 laporan lainnya lebih tua dari 30 berita terbaru sehingga tidak muncul di feed. Kalau angkanya `0`, deploy belum memuat commit terbaru — cek tab Deployments di Vercel.
