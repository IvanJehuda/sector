# Rencana Eksekusi Submit Sectors Hackathon 2026

> **Untuk agen pelaksana:** SUB-SKILL WAJIB: pakai superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengerjakan rencana ini task demi task. Langkah memakai sintaks checkbox (`- [ ]`).

**Goal:** Membawa Correlation Explainer dari "kode selesai, belum disubmit" ke paket submit lengkap sebelum 8 Oktober 2026, 23:59 WIB.

**Architecture:** Kodenya sudah selesai dan tidak perlu dirancang ulang — 251 tes lolos, `main` ada di `80054b5`, CI hijau. Yang tersisa adalah pekerjaan eksekusi: mengoreksi penjaga anggaran kredit, mengisi data (pustaka pola historis dan golden set), membenahi jalur deploy, lalu memproduksi materi submit. Dua task memuat kode sungguhan (validasi golden set dan dua perbaikan UI) dan dikerjakan TDD; sisanya operasional dengan perintah dan keluaran yang diharapkan ditulis eksplisit.

**Tech Stack:** Next.js 15, TypeScript, Vitest, Playwright, libSQL/Turso, Sectors API, OpenAI structured outputs, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-22-correlation-explainer-design.md` (desain utama) dan `docs/superpowers/specs/2026-09-23-ui-redesign.md` (redesain UI, sudah selesai). Daftar langkah asal ada di `HANDOFF.md` §4.

## Global Constraints

Diambil verbatim dari `CLAUDE.md`. Setiap task tunduk pada semua baris ini.

- Kredit Sectors tim **1.000 untuk seluruh acara** dan tidak direset. Terpakai saat rencana ini ditulis: **18** (17 di laptop rekan untuk `pnpm record`, 1 di laptop Ivan untuk verifikasi key). Sisa ~**982**.
- JANGAN memanggil API Sectors asli dari test atau saat eksperimen. Pakai fixture (`fixtures/sectors/`) atau `SECTORS_MODE=fake`.
- Semua akses Sectors lewat `lib/sectors/client.ts`. Jangan pernah `fetch` langsung ke `api.sectors.app`.
- `lib/domain.ts` adalah kontrak antar modul. Jangan diubah tanpa persetujuan tim.
- Tidak boleh ada saran investasi. Teks yang ditampilkan wajib lolos `findBannedPhrases()` (`lib/explain/guard.ts`) dan laporan wajib menyertakan `DISCLAIMER`.
- TDD: tulis test dulu. Sebelum menyatakan selesai, jalankan `pnpm test && pnpm typecheck` dan tunjukkan hasilnya.
- Teks UI dalam Bahasa Indonesia. Kode dan identifier dalam bahasa Inggris.
- Jangan commit `.env*`, `*.db`, atau API key.
- Perintah yang memakai kredit Sectors atau OpenAI (`pnpm record`, `pnpm seed:history`, `pnpm eval`, dan `pnpm dev` dengan `SECTORS_MODE=live`/`LLM_MODE=openai`) hanya boleh dijalankan setelah menyebutkan perkiraan kreditnya dan mendapat **persetujuan eksplisit dari manusia**.
- Tenggat: **8 Oktober 2026, 23:59 WIB**. Setelah submit, repo dibekukan — tidak ada commit lagi.

## Review Focus

Lima kegagalan yang paling mungkin menggigit tapi tidak diuji oleh test mana pun saat ini. Masing-masing sudah dititipkan test atau langkah verifikasinya ke task pemiliknya.

1. **Nama subsektor di golden set tidak persis sama dengan fixture universe** (beda huruf besar, spasi, atau ampersand). `precisionRecall()` membandingkan dengan `toLowerCase()` saja, jadi "Bank" vs "Banks" menghasilkan recall 0 **tanpa error apa pun** — angka akurasi di video jadi salah dan tidak ada yang tahu kenapa. → Test di Task 3.
2. **Teks golden set berupa kerangka atau jauh lebih pendek dari 80 karakter.** Ini **tidak** ditolak di mana pun pada jalur eval: `scripts/eval-golden.ts` memanggil `manualEvent()`, yang tidak melakukan validasi (`MIN_MANUAL_TEXT` hanya diterapkan di `buildManualEvent()`). Kasus itu dinilai seolah berita sungguhan dan diam-diam menurunkan recall, karena isi berita itulah yang disuntikkan ke prompt model. → Test di Task 3.
3. **`--since` pada `seed:history` terlalu baru.** `SETTLE_DAYS = 8` membuang setiap artikel yang lebih baru dari `todayWib() - 8` hari secara **diam-diam** (`continue`, tanpa log). Kalau semua artikel terbuang, `done` tetap 0 padahal kredit sudah terpakai untuk `fetchNewsPage`. → Langkah pengukuran bertahap di Task 4.
4. **`SECTORS_CREDIT_BUDGET` salah.** Nilai 1000 membuat `canSpend()` mengizinkan belanja sampai 900 di satu laptop, padahal sisa sebenarnya ~982 untuk dua laptop yang ledger-nya tidak tersinkron. Overspend tidak akan tertahan. → Task 1.
5. **Video direkam dari situs yang kedaluwarsa.** Integrasi Git Vercel tidak terpasang, jadi push ke `main` tidak men-deploy apa pun. Tanpa redeploy manual, video merekam produksi yang masih memuat bug CSS `gap-4pt-12`. → Task 2.

---

### Task 1: Koreksi penjaga anggaran kredit

Wajib paling dulu. Selama angka ini salah, setiap task berkredit berjalan tanpa pengaman yang benar.

**Files:**
- Modify: `.env.local` (tidak di-commit, ter-ignore di `.gitignore:44`)
- Modify: `HANDOFF.md` §4

**Interfaces:**
- Consumes: —
- Produces: `SECTORS_CREDIT_BUDGET` yang benar, dipakai `creditBudget()` di `lib/sectors/from-env.ts:8` dan ditegakkan `canSpend()` di `lib/sectors/budget.ts:13`.

- [ ] **Step 1: Baca sisa kredit sebenarnya dari dashboard Sectors**

Buka dashboard Sectors, catat sisa kredit. Hanya manusia yang punya akses ini. Perkiraan: ~982.

- [ ] **Step 2: Sepakati siapa yang membelanjakan kredit**

Dua laptop sekarang memegang `SECTORS_API_KEY` dan ledger-nya **tidak tersinkron** (tabel `credit_ledger` ada di file database masing-masing, lihat `lib/sectors/stores.ts:59`). Tulis kesepakatan di `HANDOFF.md` §4: hanya satu orang menjalankan `seed:history` dan `eval`. Asumsi rencana ini: **Ivan** yang menjalankannya.

- [ ] **Step 3: Set budget ke sisa sebenarnya**

Di `.env.local`, ganti nilainya ke angka dari Step 1:

```
SECTORS_CREDIT_BUDGET=982
```

Alasannya: ledger laptop ini baru mencatat 1 kredit, sedangkan 17 kredit rekan tidak terlihat dari sini. Dengan budget 982 dan ledger 1, `canSpend()` memblokir di `982 * 0.9 = 883` kredit lokal — menyisakan margin aman terhadap total tim.

- [ ] **Step 4: Verifikasi angkanya terbaca**

```bash
pnpm dev
```

Buka `http://localhost:3000`, lihat pil "KUOTA DATA TERSISA" di nav. Expected: menampilkan `981 dari 982`. Hentikan server setelah terlihat. `SECTORS_MODE=fixture` jadi langkah ini **0 kredit**.

- [ ] **Step 5: Catat di HANDOFF dan commit**

Perbarui baris anggaran di `HANDOFF.md` §4 dengan total terpakai dan tanggalnya. Commit hanya `HANDOFF.md`, jangan `.env.local`.

```bash
git add HANDOFF.md
git commit -m "docs(handoff): record real credit spend and single-spender rule"
```

---

### Task 2: Benahi jalur deploy dan nyalakan polling berita

Dikerjakan hari pertama juga, karena cron mengumpulkan berita 3× sehari — makin cepat dinyalakan, makin banyak bahan berita asli untuk dipilih saat merekam video.

**Files:**
- Modify: pengaturan GitHub repo (Settings → Secrets and variables → Actions)
- Modify: pengaturan proyek Vercel
- Read: `.github/workflows/poll.yml`

**Interfaces:**
- Consumes: `CRON_SECRET` dari `.env.local` (48 karakter, sudah terisi).
- Produces: produksi yang memuat `main@80054b5` atau lebih baru, dan feed yang terisi berita asli.

- [ ] **Step 1: Isi dua GitHub Secrets**

Di `https://github.com/IvanJehuda/sector/settings/secrets/actions`, tambahkan:

- `APP_URL` = `https://correlation-explainer.vercel.app`
- `CRON_SECRET` = nilai yang sama persis dengan `CRON_SECRET` di `.env.local` **dan** dengan environment variable `CRON_SECRET` di Vercel. Kalau ketiganya tidak identik, endpoint menolak dengan 401.

Tanpa kedua secret ini, `poll.yml` melewati dirinya sendiri secara otomatis.

- [ ] **Step 2: Putuskan jalur deploy**

Saat ini **tidak ada** deployment terdaftar di GitHub API, artinya integrasi Git Vercel tidak terpasang dan produksi adalah snapshot manual dari `vercel --prod`. Pilih satu:

- **Disarankan — pasang integrasi Git.** Di dashboard Vercel proyek `correlation-explainer`, hubungkan ke repo GitHub `IvanJehuda/sector` dengan production branch `main`. Setelah itu setiap push ke `main` men-deploy sendiri, dan tidak ada lagi langkah manual yang bisa terlupa sebelum merekam video.
- **Alternatif — redeploy manual.** Rekan menjalankan `vercel --prod` dari laptopnya setiap kali ada perubahan. Catat di `HANDOFF.md` bahwa ini wajib dilakukan sebelum merekam video.

Akun Vercel milik rekan (husinhakim), jadi langkah ini butuh dia.

- [ ] **Step 3: Deploy ulang produksi**

Pakai jalur dari Step 2. Target: produksi memuat `main@80054b5`, yang berisi perbaikan `gap-4pt-12`.

- [ ] **Step 4: Verifikasi perbaikan CSS sampai ke produksi**

```bash
css=$(curl -s https://correlation-explainer.vercel.app/ | grep -oE '/_next/static/css/[^"]+\.css' | head -1)
curl -s "https://correlation-explainer.vercel.app$css" | grep -c "pt-12"
```

Expected: angka `1` atau lebih. Kalau `0`, deploy belum memuat commit terbaru — jangan lanjut merekam video.

- [ ] **Step 5: Picu polling sekali untuk menguji rangkaiannya**

Di tab Actions GitHub, jalankan workflow `poll-news` secara manual (`workflow_dispatch`) atau tunggu jadwal berikutnya (`0 1,5,9 * * 1-5` UTC = 08:00, 12:00, 16:00 WIB pada hari kerja).

Expected: workflow hijau, dan feed di beranda bertambah berita. **Catatan kredit:** polling memanggil `/v2/news/` lewat `fetchNewsPage`, biaya **1 kredit per pemanggilan**. Tiga kali sehari × 7 hari ≈ **21 kredit** sampai tenggat. Sudah masuk anggaran.

---

### Task 3: Isi golden set, dengan test yang menjaga nama subsektor

Jalur kritis terpanjang karena butuh penilaian manusia. Mulai hari pertama, kerjakan paralel dengan Task 4.

**Files:**
- Create: `tests/eval/golden-set.test.ts`
- Modify: `data/golden-set.json`
- Read: `lib/eval/score.ts` (tipe `GoldenCase`), `lib/events/manual.ts` (`MIN_MANUAL_TEXT`)

**Interfaces:**
- Consumes: `GoldenCase` dari `lib/eval/score.ts` — `{ title: string; text: string; date: string; expected_sub_sectors: string[]; expected_symbols: string[] }`. `MIN_MANUAL_TEXT = 80` dari `lib/events/manual.ts:5`.
- Produces: `data/golden-set.json` berisi 8–10 `GoldenCase` valid, dikonsumsi `scripts/eval-golden.ts` di Task 5.

- [ ] **Step 1: Tulis test yang gagal**

Buat `tests/eval/golden-set.test.ts`. Test ini membaca fixture universe asli dan memaksa setiap nama subsektor cocok persis — kegagalan nomor 1 di Review Focus.

```ts
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIN_MANUAL_TEXT } from '@/lib/events/manual';
import type { GoldenCase } from '@/lib/eval/score';

const ROOT = process.cwd();
const FIXTURES = path.join(ROOT, 'fixtures', 'sectors');

/** Sub-sector names exactly as the recorded Sectors universe spells them. */
function universeSubSectors(): Set<string> {
  const subs = new Set<string>();
  for (const file of readdirSync(FIXTURES).filter((f) => f.startsWith('v2_companies__'))) {
    const { data } = JSON.parse(readFileSync(path.join(FIXTURES, file), 'utf8')) as {
      data: { results?: Array<{ query_values?: { sub_sector?: string } }> };
    };
    for (const row of data.results ?? []) {
      const name = row.query_values?.sub_sector;
      if (name) subs.add(name);
    }
  }
  return subs;
}

const cases = JSON.parse(readFileSync(path.join(ROOT, 'data', 'golden-set.json'), 'utf8')) as GoldenCase[];

describe('golden set', () => {
  it('holds 8 to 10 labelled events', () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
    expect(cases.length).toBeLessThanOrEqual(10);
  });

  it('spells every expected sub-sector exactly as the universe does', () => {
    const known = universeSubSectors();
    expect(known.size).toBeGreaterThan(0);
    const unknown = cases.flatMap((c) => c.expected_sub_sectors.filter((s) => !known.has(s)));
    expect(unknown).toEqual([]);
  });

  it('gives every case a body long enough for the extractor to work with', () => {
    const tooShort = cases.filter((c) => c.text.trim().length < MIN_MANUAL_TEXT).map((c) => c.title);
    expect(tooShort).toEqual([]);
  });

  it('dates every case as YYYY-MM-DD', () => {
    const bad = cases.filter((c) => !/^\d{4}-\d{2}-\d{2}$/.test(c.date)).map((c) => c.title);
    expect(bad).toEqual([]);
  });

  it('writes expected symbols as bare four-letter IDX tickers', () => {
    const bad = cases.flatMap((c) => c.expected_symbols.filter((s) => !/^[A-Z]{4}$/.test(s)));
    expect(bad).toEqual([]);
  });

  it('expects at least one sub-sector and one symbol per case', () => {
    const empty = cases
      .filter((c) => c.expected_sub_sectors.length === 0 || c.expected_symbols.length === 0)
      .map((c) => c.title);
    expect(empty).toEqual([]);
  });

  it('has no duplicate titles', () => {
    expect(new Set(cases.map((c) => c.title)).size).toBe(cases.length);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

```bash
pnpm vitest run tests/eval/golden-set.test.ts
```

Expected: `holds 8 to 10 labelled events` GAGAL dengan pesan bahwa 0 tidak lebih besar atau sama dengan 8, karena `data/golden-set.json` masih `[]`. Test lainnya lolos — tidak ada kasus salah bila tidak ada kasus sama sekali. Ini fase merah yang benar.

- [ ] **Step 3: Label 8–10 berita nyata**

Isi `data/golden-set.json`. Ini keputusan tim, bukan hal yang bisa ditebak agen. Aturannya:

- `expected_sub_sectors` **harus** salah satu dari 33 nama ini, persis: `Alternative Energy`, `Apparel & Luxury Goods`, `Automobiles & Components`, `Banks`, `Basic Materials`, `Consumer Services`, `Financing Service`, `Food & Beverage`, `Food & Staples Retailing`, `Healthcare Equipment & Providers`, `Heavy Constructions & Civil Engineering`, `Holding & Investment Companies`, `Household Goods`, `Industrial Goods`, `Industrial Services`, `Insurance`, `Investment Service`, `Leisure Goods`, `Logistics & Deliveries`, `Media & Entertainment`, `Multi-sector Holdings`, `Nondurable Household Products`, `Oil, Gas & Coal`, `Pharmaceuticals & Health Care Research`, `Properties & Real Estate`, `Retailing`, `Software & IT Services`, `Technology Hardware & Equipment`, `Telecommunication`, `Tobacco`, `Transportation`, `Transportation Infrastructure`, `Utilities`.
- `expected_symbols` tanpa akhiran `.JK` — tulis `BBRI`, bukan `BBRI.JK`.
- `text` minimal 80 karakter; tempel 2–4 kalimat inti beritanya.
- Pilih berita yang **beragam sektornya**, jangan delapan-duanya soal bank, supaya angka presisi/recall tidak menyesatkan.

Contoh satu kasus dengan bentuk yang benar:

```json
[
  {
    "title": "Pemerintah naikkan porsi dividen bank BUMN ke 70 persen laba",
    "text": "Kementerian BUMN meminta bank pelat merah menyetor porsi laba lebih besar mulai tahun buku 2026. Kebijakan ini menyasar empat bank milik negara dan diperkirakan menekan rasio kecukupan modal mereka dalam jangka pendek.",
    "date": "2026-03-02",
    "expected_sub_sectors": ["Banks"],
    "expected_symbols": ["BBRI", "BMRI", "BBNI", "BRIS"]
  }
]
```

- [ ] **Step 4: Jalankan test untuk memastikan lolos**

```bash
pnpm vitest run tests/eval/golden-set.test.ts
```

Expected: 7 test PASS. Kalau `spells every expected sub-sector exactly` gagal, pesannya memuat nama yang salah tulis — perbaiki ejaannya agar persis sama dengan daftar di Step 3.

- [ ] **Step 5: Jalankan seluruh suite dan typecheck**

```bash
pnpm test && pnpm typecheck
```

Expected: 258 test lolos (251 + 7 baru), typecheck tanpa output.

- [ ] **Step 6: Commit**

Commit hanya setelah hijau, supaya `main` dan CI tidak pernah merah.

```bash
git add tests/eval/golden-set.test.ts data/golden-set.json
git commit -m "test(eval): pin golden set shape to the recorded universe"
```

---

### Task 4: Step 4 — bangun pustaka pola historis

**MEMAKAI KREDIT.** Jangan jalankan sebelum menyebut perkiraan dan mendapat izin eksplisit (Global Constraints, aturan 9). Bertahap: ukur dulu dengan 3 event, baru naikkan.

**Files:**
- Read: `scripts/seed-history.ts`
- Modify: `HANDOFF.md` §1

**Interfaces:**
- Consumes: slug tag `politics-regulation` dari hasil `pnpm record` (tercatat di `README.md`). Butuh `SECTORS_MODE=live`; skrip menolak jalan tanpa itu.
- Produces: baris `reports` di database yang dibaca `lib/history/` untuk blok "Berita serupa sebelumnya" di laporan mode HIPOTESIS.

- [ ] **Step 1: Minta izin kredit**

Sebutkan ke manusia: tahap ukur **≤30 kredit**, tahap penuh **≤120 kredit** (angka dari `HANDOFF.md` §4). Tunggu persetujuan eksplisit sebelum Step 2.

- [ ] **Step 2: Jalankan tahap ukur dengan 3 event**

```bash
SECTORS_MODE=live pnpm seed:history --tag politics-regulation --since 2026-06-01 --limit 3
```

`--since 2026-06-01` dipilih supaya jauh di belakang batas `SETTLE_DAYS`. Hari ini 2026-10-01, jadi skrip membuang artikel yang lebih baru dari **2026-09-23** secara diam-diam. Artikel Juni–September lolos.

Expected: tiga baris berformat `OK  <judul> | retrospective | N saham | M kredit`, lalu `Selesai: 3 event. Total kredit: X.`

- [ ] **Step 3: Baca angka kredit per event dan putuskan**

Hitung `X / 3`.

- Rata-rata **≤ 10 kredit**: lanjut Step 4.
- Rata-rata **> 10 kredit**: berhenti. 12 event lagi akan melewati 120. Laporkan angkanya ke manusia dan minta keputusan apakah tetap lanjut dengan `--limit` lebih kecil.
- `Selesai: 0 event`: semua artikel terbuang oleh batas tanggal, atau tag tidak mengembalikan apa pun. Jangan ulangi dengan parameter sama. Periksa `fixtures/sectors/v2_tags__a851838570.json` untuk slug alternatif (`government-policy`, `ministry`, `ojk`, `central-bank`, `interest-rate`) dan laporkan ke manusia.

- [ ] **Step 4: Jalankan tahap penuh**

```bash
SECTORS_MODE=live pnpm seed:history --tag politics-regulation --since 2026-06-01 --limit 12
```

Event dari Step 2 tidak dihitung ulang: `insertEvent` memakai `ON CONFLICT(url) DO NOTHING` (`lib/db/repo.ts:40`) dan data harga sudah ada di cache, jadi biayanya mendekati nol untuk ketiga event itu.

Expected: `Selesai: 12 event. Total kredit: Y.` dengan `Y` di bawah 120.

- [ ] **Step 5: Verifikasi pustaka terpakai di laporan**

```bash
pnpm dev
```

Buka sebuah laporan di `/events/<id>`, lihat blok "Berita serupa sebelumnya". Expected: bukan lagi "Belum ada berita serupa di pustaka kami", melainkan baris berformat `<subsektor>: dari N berita serupa, rata-rata ...`. Mode fixture, **0 kredit**.

- [ ] **Step 6: Catat hasil dan commit**

Tulis jumlah event dan kredit terpakai ke `HANDOFF.md` §1 baris Step 4.

```bash
git add HANDOFF.md
git commit -m "docs: record history seeding results and credit spend"
```

---

### Task 5: Step 5 — jalankan eval dan tulis angka akurasinya

**MEMAKAI KREDIT SECTORS DAN TOKEN OPENAI.** Butuh Task 3 selesai.

**Files:**
- Read: `scripts/eval-golden.ts`, `lib/eval/score.ts`
- Modify: `README.md` (bagian "Golden set")

**Interfaces:**
- Consumes: `data/golden-set.json` dari Task 3.
- Produces: angka presisi/recall subsektor dan saham, dipakai di skenario ke-4 video walkthrough (Task 7).

- [ ] **Step 1: Minta izin kredit dengan perkiraan yang benar**

Perkiraan: **≤40 kredit Sectors**. Alasannya penting dan berbeda dari dugaan awal — `scripts/eval-golden.ts` **tidak** memanggil `analyzeEvent`, jadi tidak mengambil data harga sama sekali. Yang dipanggil hanya `market.universe()` (962 emiten unik dibagi 200 per halaman = 5 kredit, lalu di-cache) plus `collectGroups`/`collectIndexes` sebanyak grup dan indeks yang disebut tiap berita (1 kredit per pemanggilan, sebagian besar sudah ada di cache dari Task 4). Biaya OpenAI: satu panggilan `extractEventProfile` per kasus, 8–10 panggilan `gpt-4o-mini` — beberapa sen.

Tunggu persetujuan eksplisit.

- [ ] **Step 2: Jalankan eval**

```bash
SECTORS_MODE=live LLM_MODE=openai pnpm eval
```

Expected: tabel `console.table` satu baris per kasus berisi kolom `event`, `subP`, `subR`, `symP`, `symR`, lalu dua baris rata-rata untuk subsektor dan saham.

- [ ] **Step 3: Baca hasilnya secara jujur**

Recall subsektor di bawah 0,5 berarti profil LLM sering melewatkan subsektor yang diharapkan. Kalau itu terjadi, **jangan diam-diam mengganti golden set agar angkanya bagus** — itu membuat angka di video tidak bermakna. Pilihan yang sah: laporkan angkanya apa adanya, atau naikkan `OPENAI_MODEL` ke model yang lebih kuat (saat ini `gpt-4o-mini`) lalu jalankan ulang dan laporkan keduanya.

- [ ] **Step 4: Tulis angkanya ke README**

Ganti baris placeholder di `README.md` bagian "Golden set" (`belum diisi — jalankan pnpm eval dengan API key`) dengan angka sebenarnya beserta tanggal, jumlah kasus, dan model yang dipakai.

- [ ] **Step 5: Jalankan suite dan commit**

```bash
pnpm test && pnpm typecheck
```

```bash
git add README.md HANDOFF.md
git commit -m "docs: record golden set evaluation results"
```

---

### Task 6: Bereskan dua temuan UI dari review

Prioritas paling rendah. Kerjakan hanya kalau Task 1–5 sudah selesai dan masih ada waktu sebelum produksi video. Keduanya kosmetik/aksesibilitas, bukan bug fungsional.

**Files:**
- Modify: `components/CorrelationBoard.tsx` (blok kartu, sekitar baris 141–160)
- Modify: `components/AnalyzeForm.tsx:43`

**Interfaces:**
- Consumes: —
- Produces: tidak ada perubahan antarmuka modul.

- [ ] **Step 1: Jadikan kartu papan korelasi bukan tab stop yang mati**

Kartu di `CorrelationBoard` adalah `<button type="button">` tanpa `onClick`, jadi keyboard berhenti di empat tombol yang tidak melakukan apa pun saat Enter. Fokus memang menyalakan garis, tapi elemen `button` menjanjikan aksi yang tidak ada.

Ganti elemen pembuka `<button` menjadi `<div`, hapus atribut `type="button"`, lalu tambahkan `tabIndex={0}` dan `role="img"`. Pertahankan `onMouseEnter`, `onMouseLeave`, `onFocus`, `onBlur`, `aria-label`, `style`, dan seluruh `className`. Hapus `cursor-pointer` dari daftar class karena tidak ada lagi yang bisa diklik. Ganti tag penutupnya menjadi `</div>`.

- [ ] **Step 2: Tampilkan syarat 80 huruf di ponsel**

Di `components/AnalyzeForm.tsx:43`, petunjuk `ISI BERITA MINIMAL 80 HURUF` memakai `className="hidden sm:inline"`, jadi pengguna ponsel tidak pernah melihatnya dan baru tahu setelah server menolak. Hapus `hidden sm:inline` dan ganti menjadi `text-[10px] sm:text-[11px]` supaya tetap muat di layar sempit.

- [ ] **Step 3: Jalankan suite, typecheck, dan E2E**

```bash
pnpm test && pnpm typecheck && pnpm e2e
```

Expected: semua lolos. E2E penting di sini karena `e2e/analyze.spec.ts` mencari label form berdasarkan teksnya.

- [ ] **Step 4: Commit**

```bash
git add components/CorrelationBoard.tsx components/AnalyzeForm.tsx
git commit -m "fix(ui): drop dead tab stops on the board and show the length hint on phones"
```

- [ ] **Step 5: Deploy ulang**

Pakai jalur dari Task 2 Step 2, lalu ulangi verifikasi Task 2 Step 4. Perubahan UI yang tidak ter-deploy tidak akan terlihat di video.

---

### Task 7: Paket submit

Butuh Task 2 (produksi mutakhir), Task 4 (pola historis untuk skenario 3), dan Task 5 (angka untuk skenario 4).

**Files:**
- Modify: `README.md` (problem statement, nama anggota, track)
- Modify: `HANDOFF.md` §1

**Interfaces:**
- Consumes: semua task sebelumnya.
- Produces: submission lengkap.

- [ ] **Step 1: Pastikan repo publik**

Repo wajib publik dan tetap publik 90 hari setelah pengumuman. Cek di GitHub Settings → General.

- [ ] **Step 2: Rapikan README untuk penilai**

Pastikan ada, di bagian atas dan mudah ditemukan: problem statement satu kalimat, track **AI Agents & Assistants**, nama seluruh anggota tim, tautan demo `https://correlation-explainer.vercel.app`, dan cara menjalankan lokal (`SECTORS_MODE=fake LLM_MODE=fake pnpm dev`) supaya penilai bisa mencoba tanpa API key.

- [ ] **Step 3: Verifikasi ulang produksi tepat sebelum merekam**

Ulangi Task 2 Step 4. Jangan merekam sebelum angkanya `1` atau lebih.

- [ ] **Step 4: Rekam video walkthrough, maksimal 3 menit**

Empat skenario dari `HANDOFF.md` §4, berurutan:

1. Pidato atau kebijakan BUMN — tempel teks, tunjukkan laporan retrospektif dengan tabel bukti dan bar CAR.
2. Tempel tautan berita global — tunjukkan pengambilan artikel dari URL berjalan.
3. Event prospektif — tunjukkan mode HIPOTESIS beserta blok "Berita serupa sebelumnya" dari Task 4.
4. Angka golden set dari Task 5.

Sebutkan di narasi bahwa ini analisis data historis dan bukan saran investasi, sejalan dengan `DISCLAIMER` yang tampil di laporan.

- [ ] **Step 5: Rekam video teaser 1 menit**

Potong dari walkthrough. Fokus: masalah, satu demo yang meyakinkan, nama produk.

- [ ] **Step 6: Post di sosial media**

IG/LinkedIn/Threads/TikTok, tag akun Sectors, pakai template thumbnail acara.

- [ ] **Step 7: Perbarui HANDOFF sebagai catatan akhir**

Tandai Step 4, 5, 6, 7 di `HANDOFF.md` §1 dengan tanggal dan hasilnya.

```bash
git add HANDOFF.md README.md
git commit -m "docs: final handoff status before submission"
git push origin main
```

- [ ] **Step 8: Submit, lalu bekukan repo**

Kirim formulir submit sebelum **8 Oktober 2026, 23:59 WIB**. Setelah terkirim: **tidak ada commit atau push lagi**.

---

## Jadwal yang disarankan

| Tanggal | Isi |
|---|---|
| 1 Okt | Task 1, Task 2, mulai Task 3 Step 1–2 |
| 2–3 Okt | Task 3 (label golden set) paralel dengan Task 4 |
| 4 Okt | Task 5 |
| 5 Okt | Task 6 kalau ada waktu, lalu deploy final |
| 6–7 Okt | Task 7: video, post |
| 7 Okt | Submit, menyisakan sehari penuh sebagai cadangan |
| 8 Okt | Tenggat. Jangan menyisakan pekerjaan di hari ini. |

## Anggaran kredit keseluruhan

| Pos | Perkiraan |
|---|---|
| Sudah terpakai (record + verifikasi key) | 18 |
| Task 2: polling 3×/hari sampai tenggat | ~21 |
| Task 4: seed:history | ≤120 |
| Task 5: eval | ≤40 |
| Demo dan rekaman video | ~40 |
| **Total** | **~239 dari 1.000** |

Longgar. Tidak ada alasan memotong cakupan karena kredit. Sisa ~760 adalah cadangan untuk pengulangan kalau ada yang gagal.
