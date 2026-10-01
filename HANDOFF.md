# HANDOFF: Correlation Explainer (Sectors Hackathon 2026)

> **Untuk manusia dan coding agent.** Baca file ini dulu, lalu `CLAUDE.md` (aturan wajib), lalu spec.
> Terakhir diperbarui: **2026-09-22** oleh Ivan. Tenggat submit: **30 Sep 2026, 23:59 WIB**. Setelah submit, repo dibekukan: tidak boleh ada commit lagi.

## 1. Status saat ini

| Bagian | Status |
|---|---|
| Kode aplikasi (22 task rencana + 12 perbaikan dari review akhir) | ✅ Selesai, sudah di `main` |
| Test | ✅ 242 unit/integration test, 3 E2E, typecheck, lint 0 error, dan `next build` lolos |
| Step 1: setup laptop dan jalan di mode palsu | ✅ Sudah dicek di laptop Ivan (Windows) |
| Step 2: `.env.local` | ✅ 23 Sep, di laptop pemegang key |
| Step 3: rekam data asli Sectors (`pnpm record`) | ✅ 23 Sep, 17 kredit. Universe 962 emiten, sub_sector OK, 242 test lolos dengan fixture asli. Slug tag: `politics-regulation` |
| Redesain UI (tema gelap, papan korelasi, copy awam) | ✅ 23 Sep. Desain + riset copy di `docs/superpowers/specs/2026-09-23-ui-redesign.md` dan `docs/research/2026-09-23-copywriting.md`. Label "Keyakinan" jadi "Bukti kuat/sedang/lemah"; form jadi satu kotak tautan-atau-teks |
| Step 4: pustaka pola historis (`pnpm seed:history`) | ✅ 1 Okt, 80 kredit (36 tahap ukur + 44 tahap penuh). 12 laporan retrospektif di `local.db` laptop Ivan, tag `politics-regulation`; 8 berjenis "kebijakan". Pembanding terkuat: Oil, Gas & Coal, Banks, Industrial Goods |
| Step 5: golden set dan `pnpm eval` | 🟡 1 Okt: golden set terisi (10 berita, 12 subsektor, label dari tag redaksi Sectors, lihat commit `bd0a8b6`). `pnpm eval` belum |
| Step 6: deploy (Vercel + Turso) dan polling terjadwal | 🟡 24 Sep: live di https://correlation-explainer.vercel.app (akun Vercel husinhakim, Turso `correlation-explainer`, `SECTORS_MODE=fixture`). GitHub Secrets poll belum |
| Step 7: video, post, dan submit | ⬜ Belum |

**Yang paling berisiko:** kode belum pernah bertemu data asli Sectors. Semua test memakai sampel dari dokumentasi atau data palsu. Karena itu **step 3 harus dikerjakan paling dulu**. Kalau ada yang tidak cocok, akan kelihatan di sana (lihat §4).

## 2. Peta cepat

```
app/                 UI (beranda, /events/[id]) dan API (/api/analyze, /api/events, /api/credits, /api/cron/poll)
components/          AnalyzeForm, Feed, ReportView, CreditBanner, …
lib/domain.ts        Kontrak tipe antar modul (jangan diubah sembarangan)
lib/sectors/         Klien Sectors: cache, pencatat kredit, batas budget, mode fixture/record/live/fake
lib/market/          Matematika murni: tanggal WIB, jendela harga, abnormal return, z-score
lib/agent/           LLM (OpenAI structured outputs), profil event, penyusunan kandidat saham
lib/explain/         Penjaga kata "saran investasi", disclaimer, narasi dan fallback template
lib/history/         Pola historis dari laporan tersimpan
lib/events/          Ambil artikel dari URL (aman dari SSRF), berita Sectors, input manual, polling
lib/pipeline/        analyzeEvent (orkestrasi), guard analisis publik, wiring dari env
scripts/             record-fixtures, poll, seed-history, eval-golden (semua baca .env.local)
tests/ e2e/          Vitest dan Playwright
docs/superpowers/    spec (acuan utama) dan plan (riwayat implementasi)
```

**Kode adalah sumber kebenaran.** Plan di `docs/superpowers/plans/` menjelaskan 22 task awal. Setelah itu ada perbaikan dari review akhir yang *tidak* tertulis di plan:
- Guard analisis publik: `lib/pipeline/guard.ts`, env `PUBLIC_ANALYSIS_*`
- Pengambilan URL anti-SSRF: `lib/events/article.ts`, `lib/events/ip.ts`
- Klaim analisis atomik supaya tidak jalan dobel: `claimEventForAnalysis`, kolom `status_updated_at`
- Kandidat "disebut langsung" diurutkan berdasarkan market cap
- Maksimal 1 petunjuk indeks per analisis
- Kuota habis hanya menggagalkan saham yang bersangkutan, bukan seluruh analisis
- Secret cron dibandingkan dengan cara timing-safe
- `getDb` mencoba ulang setelah migrasi gagal
- `pnpm build` tanpa turbopack

## 3. Setup laptop (step 1, ±10 menit)

```bash
git clone https://github.com/IvanJehuda/sector.git && cd sector
npm i -g pnpm@9            # corepack bawaan Node bisa error "Cannot find matching keyid", jadi pakai npm
pnpm install
pnpm exec playwright install chromium
pnpm test                  # harus 242 passed
```

Coba aplikasi tanpa kredit dan tanpa API key (semua data **palsu**):

```bash
# bash / Git Bash
SECTORS_MODE=fake LLM_MODE=fake FAKE_SHOCK_DAY=2026-03-02 DATABASE_URL=file:dev.db pnpm dev
```
```powershell
# PowerShell
$env:SECTORS_MODE='fake'; $env:LLM_MODE='fake'; $env:FAKE_SHOCK_DAY='2026-03-02'; $env:DATABASE_URL='file:dev.db'; pnpm dev
```

Lalu:
1. Buka http://localhost:3000.
2. Tempel teks lebih dari 80 karakter, isi tanggal **2026-03-02**, lalu klik **Analisis berita**. BBRI dan BMRI palsu "anjlok" di tanggal itu.
3. Untuk mengisi feed contoh, panggil `GET /api/cron/poll` dengan header `Authorization: Bearer <CRON_SECRET>`. Set juga `CRON_SECRET=dev-secret` di env.

`pnpm dev` butuh sekitar 1–2 GB RAM. Tutup aplikasi berat lain kalau laptopnya mepet.

## 4. Langkah berikutnya (urut, dengan anggaran kredit)

**Kredit melekat pada akun Sectors, bukan pada tim: tiap akun mendapat 600 dan tidak direset.** Per 1 Okt, key di `.env.local` laptop Ivan adalah milik rekan, dengan sisa sekitar 502 (600 − 17 `pnpm record` − 1 cek key − 80 Step 4). Tim juga punya API key sendiri yang belum dipakai. Pencatat kredit tersimpan di `local.db` **per laptop**, jadi tidak tersinkron antar anggota. Aturan tim:
- Hanya **satu orang** yang memegang `SECTORS_API_KEY` untuk langkah yang memakai kredit.
- Cek sisa kredit asli di dashboard Sectors.
- Set `SECTORS_CREDIT_BUDGET` di `.env.local` ke **sisa kredit sebenarnya**.

### Step 2: `.env.local` (tidak di-commit)
```bash
cp .env.example .env.local
```
Isi `SECTORS_API_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL` (model OpenAI apa pun yang mendukung structured outputs), dan `CRON_SECRET` (string acak panjang).
⚠️ Default `SECTORS_MODE=fixture` di `.env.example` **tidak bisa dipakai untuk `pnpm dev`** sebelum fixture direkam, karena akan muncul `FixtureMissingError`. Untuk dev, pakai `fake`. Untuk data asli, pakai `live`.

### Step 3: rekam data asli (±15–20 kredit, sekali saja)
```bash
pnpm record              # default event 2025-03-18; bisa diganti: pnpm record 2026-08-12
pnpm test                # contract test memvalidasi semua fixture asli
```
- **Catat daftar tag berita** yang dicetak di akhir log. Kamu butuh slug untuk "Politics & Regulation" di step 4. Tulis juga ke README bagian "Tag berita".
- Kalau muncul `PERINGATAN: query_values screener tidak memuat sub_sector`, pemetaan subsektor rusak. Buka `fixtures/sectors/v2_companies_*.json`, lihat field yang tersedia, lalu sesuaikan `UNIVERSE_WHERE` / `fetchUniverse` di `lib/sectors/endpoints.ts` (spec §4). Tulis test dulu (TDD).
- Kalau `pnpm test` gagal di `tests/sectors/schemas.test.ts`, bentuk respons asli berbeda dari dokumentasi. Perbaiki skema di `lib/sectors/schemas.ts` dengan `.nullable().optional()`, jangan menghapus field.
- Commit `fixtures/sectors/` lalu push.
- Setelah itu, coba satu analisis dengan data asli: `SECTORS_MODE=live LLM_MODE=openai pnpm dev`. Biayanya maksimal sekitar 19 kredit untuk event pertama.

### Step 4: pustaka pola historis (maksimal ±120 kredit)
```bash
SECTORS_MODE=live pnpm seed:history --tag <slug-dari-step-3> --since 2026-06-01 --limit 3
```
Lihat kredit per event di log. Kalau rata-rata ≤ 10, jalankan lagi dengan `--limit 12`. Event yang sudah dianalisis tidak memakai kredit lagi.

### Step 5: golden set (untuk angka akurasi di video)
- Isi `data/golden-set.json` dengan 8–10 berita **nyata**, formatnya ada di plan Task 21.
- Nama subsektor harus persis sama dengan fixture universe.
- Jalankan `SECTORS_MODE=live LLM_MODE=openai pnpm eval`, lalu tulis hasil presisi/recall ke README.

### Step 6: deploy (opsional)
Ikuti README bagian Deploy (Turso + Vercel). Setelah deploy:
- Isi GitHub Secrets `APP_URL` dan `CRON_SECRET` supaya workflow `poll-news` menarik berita 3× sehari. Tanpa secret itu, workflow otomatis dilewati.
- Analisis dari publik dibatasi 20 per hari dan berhenti di 70% kuota. Atur lewat `PUBLIC_ANALYSIS_DAILY_LIMIT` dan `PUBLIC_ANALYSIS_BUDGET_RATIO`.

### Step 7: submit (sebelum 30 Sep 23:59 WIB)
- [ ] Repo GitHub **publik**, dan tetap publik 90 hari setelah pengumuman
- [ ] Video teaser 1 menit
- [ ] Video walkthrough maksimal 3 menit. Skenario: (1) pidato atau kebijakan BUMN, (2) tempel link berita global, (3) event prospektif (HIPOTESIS) dengan pola historis, (4) angka golden set
- [ ] Problem statement satu kalimat (ada di README), track **AI Agents & Assistants**, dan nama anggota
- [ ] Post di IG/LinkedIn/Threads/TikTok dengan tag akun Sectors dan template thumbnail
- [ ] **Setelah submit: tidak ada commit atau push lagi**

## 5. Risiko yang sengaja dibiarkan (keputusan yang sudah dibuat)

| Risiko | Dampak | Kapan perlu diperbaiki |
|---|---|---|
| DNS rebinding pada pengambilan URL (host dicek dulu, `fetch` me-resolve ulang) | Server DNS jahat masih bisa menjangkau alamat internal dari instance yang di-deploy | Kalau deploy publik jangka panjang; perlu IP pinning lewat undici dispatcher |
| Kiriman manual yang ditolak (429) tetap tercatat sebagai event "new" di feed | Feed sedikit kotor | Pertimbangkan menyembunyikan event manual di feed publik |
| Event manual pengunjung tampil di feed publik | Judul dari orang lain bisa muncul | Keputusan produk |
| Batas harian dan kuota bisa terlewati sedikit saat ada request bersamaan | Beberapa kredit | Diserap cadangan 10% |
| Respons 404 dari Sectors memotong kredit tapi tidak di-cache | Pemborosan kecil kalau simbol yang sama salah berulang kali | Opsional |
| Urutan feed memakai string tanggal dengan format campuran | Urutan kurang rapi | Kosmetik |

## 6. Cara kerja dengan coding agent (supaya efektif)

- **Aturan wajib ada di `CLAUDE.md`.** Singkatnya: tidak boleh memanggil API asli dari test, akses Sectors hanya lewat `lib/sectors/client.ts`, `lib/domain.ts` adalah kontrak, tidak boleh ada saran investasi, TDD, dan `pnpm test && pnpm typecheck` sebelum menyatakan selesai.
- **Satu tugas per sesi agent.** Berikan tugas yang spesifik, misalnya "kerjakan Step 3 di HANDOFF.md", jangan "lanjutkan proyek".
- Kerjakan di branch atau worktree terpisah, lalu merge ke `main` setelah test hijau. Kalau pakai Claude Code dengan plugin superpowers:
  - Fitur baru: `/superpowers:brainstorming`, lalu `writing-plans`, lalu `subagent-driven-development`
  - Bug: `/superpowers:systematic-debugging`
- **Agent tidak boleh memegang kredit tanpa izin.** Perintah yang memakai kredit (`pnpm record`, `seed:history`, `eval`, dan `dev` dengan `SECTORS_MODE=live`) hanya dijalankan kalau manusia secara eksplisit mengizinkan. Minta agent menampilkan perkiraan kredit dulu.
- Untuk UI, pakai mode `fake`, jadi tidak ada kredit maupun OpenAI yang terpakai.
- **Perbarui file ini** (tabel §1) setiap kali menyelesaikan satu step, supaya orang atau agent berikutnya tahu posisinya.

### Prompt pertama yang bisa langsung ditempel ke coding agent
```
Baca HANDOFF.md, CLAUDE.md, dan docs/superpowers/specs/2026-09-22-correlation-explainer-design.md.
Tugasmu: kerjakan "Step 3: rekam data asli" di HANDOFF.md §4.
Aturan: jangan menjalankan perintah yang memakai kredit Sectors sebelum menjelaskan perkiraan
kreditnya dan menunggu persetujuan saya. Kalau pnpm test gagal atau muncul PERINGATAN sub_sector,
cari akar masalahnya dulu, tulis test yang gagal, baru perbaiki. Setelah selesai, jalankan
pnpm test && pnpm typecheck, tunjukkan hasilnya, lalu perbarui tabel status di HANDOFF.md §1.
```

## 7. Referensi
- Aturan hackathon: https://hackathon.sectors.app/rules
- Dokumentasi API Sectors: https://docs.sectors.app (indeks lengkap: https://docs.sectors.app/llms.txt)
- Spec: `docs/superpowers/specs/2026-09-22-correlation-explainer-design.md`
- Plan (riwayat 22 task): `docs/superpowers/plans/2026-09-22-correlation-explainer.md`
