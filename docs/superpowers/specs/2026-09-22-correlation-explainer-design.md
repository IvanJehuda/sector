# Correlation Explainer: Desain

**Tanggal:** 2026-09-22
**Hackathon:** Sectors Hackathon 2026. Pengumpulan paling lambat **30 Sep 2026, 23:59 WIB**, dan repo dibekukan setelahnya.
**Track:** AI Agents & Assistants (cadangan: Market Intelligence)
**Tim:** 4 orang, dikerjakan dengan bantuan coding agent

## 1. Masalah dan pernyataan satu kalimat

Investor ritel Indonesia membaca berita (misalnya pidato presiden, kebijakan baru, atau konflik global) tetapi tidak tahu saham IDX mana yang terkait, dan tidak bisa membedakan apakah sebuah saham turun *karena* berita itu atau hanya ikut pasar.

> **Problem statement:** *Correlation Explainer mengubah berita dan event apa pun menjadi daftar saham IDX yang terkait, beserta bukti reaksi pasar dari data Sectors, sehingga investor pemula paham "apa hubungannya berita ini dengan saham itu" tanpa menerima saran investasi.*

## 2. Ruang lingkup

### Termasuk (MVP)
- **Dua mode input:**
  1. **Penerima otomatis.** Berita IDX dari Sectors (`/v2/news/`) ditarik berkala dan ditampilkan di feed. Analisis mendalam hanya berjalan **saat user klik**.
  2. **Manual.** User menempel **link** berita, atau **teks** kalau link gagal dibaca. Tanggal event bisa diisi manual.
- **Dua mode analisis, dipilih otomatis:**
  - **Retrospektif (fitur inti).** Dipakai kalau sudah ada hari bursa ≥ tanggal event. Menampilkan bukti reaksi pasar per saham: abnormal return dibanding IHSG, signifikansi statistik, foreign flow, dan perbandingan dengan peer subsektor.
  - **Prospektif (tambahan, berlabel "HIPOTESIS").** Dipakai kalau belum ada hari bursa setelah event. Menampilkan kaitan saham dan **pola historis** dari laporan retrospektif event serupa yang sudah tersimpan.
- Laporan berbahasa Indonesia: rantai sebab-akibat, bukti, tingkat keyakinan, dan disclaimer.
- Pencatat kredit dan batas budget yang tegas. Cache-first. Mode fixture untuk development.

### Tidak termasuk (YAGNI, sengaja dibuang)
- Scraping media sosial, karena melanggar ToS, rapuh, dan datanya bising.
- Data intraday, karena Sectors hanya menyediakan data harian.
- Login atau akun user, watchlist, dan notifikasi.
- Embedding atau vector DB. Kemiripan event cukup dicocokkan lewat jenis event dan subsektor.
- Data tambang/komoditas. Pencarian perusahaan tambang tercatat terlalu mahal kredit (366 perusahaan, maksimal 30 per halaman). Komoditas dipetakan lewat subsektor.
- Eksekusi order, dan kata-kata rekomendasi beli/jual/tahan (dilarang oleh aturan hackathon).

## 3. Arsitektur

Full-stack TypeScript dalam satu repo: **Next.js 15 (App Router)**, **SQLite via libSQL** (file lokal saat development; Turso kalau di-deploy), dan **OpenAI API** (structured outputs dengan skema zod). Model OpenAI diatur lewat env `OPENAI_MODEL`.

Alasannya: satu bahasa dengan tipe end-to-end mengurangi bug integrasi saat 4 orang dan agent bekerja paralel. libSQL memakai client yang sama untuk file lokal, `:memory:` di test, dan Turso di cloud, tanpa perlu setup server database.

### Modul (satu modul, satu tanggung jawab)

| Modul | Tanggung jawab | Kontrak utama |
|---|---|---|
| `lib/domain.ts` | Tipe domain bersama, sebagai kontrak antar modul | `EventInput`, `Company`, `Candidate`, `Reaction`, `StockFinding`, `Report` |
| `lib/db` | Koneksi libSQL, migrasi, repository (`events`, `reports`, `api_cache`, `credit_ledger`, `kv`) | `createDb(url)`, `migrate(db)` |
| `lib/sectors` | Klien HTTP Sectors: mode `fixture`/`record`/`live`, cache, pencatat kredit, batas budget, retry. Skema zod untuk setiap endpoint. Adapter `MarketData` | `createSectorsClient(...)`, `createSectorsMarketData(client)` |
| `lib/market` | Fungsi murni: hari event, jendela harga, return, abnormal return, signifikansi, flag pergerakan pasar luas | `eventCalendarDate()`, `priceWindow()`, `measureReaction()` |
| `lib/agent` | Antarmuka LLM (OpenAI dan versi palsu untuk test), ekstraksi `EventProfile`, penyusunan kandidat | `LlmClient`, `extractEventProfile()`, `buildCandidates()` |
| `lib/explain` | Penjaga kata terlarang, disclaimer, skor keyakinan, narasi LLM dengan fallback template | `findBannedPhrases()`, `scoreConfidence()`, `narrate()` |
| `lib/history` | Pola historis dari laporan retrospektif yang tersimpan | `findAnalogs()` |
| `lib/events` | Ekstraksi artikel dari URL, konversi berita Sectors menjadi event, polling feed | `fetchArticle()`, `newsToEvent()`, `pollNews()` |
| `lib/pipeline` | Orkestrasi: event → profil → kandidat → bukti → laporan | `analyzeEvent()` |
| `app/` | UI (beranda: kolom tempel dan feed; halaman laporan) dan route API | `POST /api/analyze`, `GET /api/events/[id]`, `GET /api/cron/poll`, `GET /api/credits` |

## 4. Data dari Sectors yang dipakai

Semua endpoint ada di `https://api.sectors.app`, dengan header `Authorization: <API_KEY>`.

| Kebutuhan | Endpoint | Kredit | Cache |
|---|---|---|---|
| Daftar emiten (validasi kode saham, subsektor, market cap) | `GET /v2/companies/?where=market_cap > 0 and sub_sector != ''&order_by=-market_cap&limit=200&offset=N&include_query_values=true` (≈5 halaman) | 1 per halaman | 7 hari |
| Anggota grup usaha | `GET /v2/companies/?where=affiliates in ['<Grup>']&limit=50` | 1 | 7 hari |
| Anggota indeks (misal BUMN) | `GET /v2/companies/?where=indices in ['IDXBUMN20']&limit=50` | 1 | 7 hari |
| Afiliasi grup satu emiten | `GET /v2/company/report/{symbol}/?sections=overview` → `overview.affiliates` | 1 | 7 hari |
| Harga harian saham | `GET /v2/daily/{symbol}/?start&end` (maks. 90 hari) | 1 | permanen kalau `end` < hari ini, selain itu 1 jam |
| Harga indeks (IHSG) | `GET /v2/index-daily/ihsg/?start&end` | 1 | sama seperti harga saham |
| Foreign flow | `GET /v2/foreign-flow/{symbol}/?start&end` | 1 | sama seperti harga saham |
| Top losers 1 hari (hanya untuk event terbaru) | `GET /v2/companies/top-changes/?classifications=top_losers&periods=1d&n_stock=10` | 1 | 1 jam |
| Feed berita | `GET /v2/news/?start=YYYY-MM-DD&limit=30&offset=N` (maks. 3 halaman per polling) | 1 per halaman | 30 menit |

**Batasan data yang diketahui dan cara menanganinya:**
- **Tidak ada indeks sektoral** di Sectors. Indeks yang tersedia: `ihsg`, `lq45`, `idx30`, `idxbumn20`, `jii70`, `kompas100`, dan lain-lain. Karena itu abnormal return dihitung terhadap **IHSG**, dan pembanding sektor adalah **rata-rata CAR kandidat di subsektor yang sama**.
- Kode saham di response bisa berakhiran `.JK`, jadi selalu dinormalisasi dengan `normalizeSymbol()`.
- Bentuk `query_values` pada screener harus **dicek ulang terhadap fixture asli**. Kalau `sub_sector` tidak ikut di response, sesuaikan klausa `where` di Task 5.

## 5. Alur data

1. **Masuk.**
   - (a) Cron/polling: `pollNews()` mengambil berita baru sejak waktu polling terakhir, lalu upsert ke `events` dengan `source='feed'` dan status `new`.
   - (b) Manual: `POST /api/analyze {url?|text?, title?, date?}` membuat event baru dengan `source='manual'`. Kalau URL-nya sudah ada di tabel `events`, event itu dipakai ulang.
2. **Profil (LLM).** `extractEventProfile()` menghasilkan `EventProfile`: ringkasan, jenis event, tema, perusahaan yang disebut, subsektor (hanya dari daftar yang diberikan), petunjuk indeks, grup usaha, dan hipotesis arah per subsektor.
3. **Kandidat.** `buildCandidates()` menyusun kandidat dengan prioritas `direct` > `group` > `index` > `sector`, lalu market cap dari besar ke kecil. **Kode saham yang tidak ada di daftar emiten dibuang.** Enam kandidat teratas mendapat bukti harga (`withEvidence=true`), sisanya masuk `otherLinks`.
4. **Mode.** Hari event = `eventCalendarDate(publishedAt)`. Waktu dianggap WIB, dan berita yang terbit pukul ≥ 16:00 WIB dihitung ke hari berikutnya. Kalau data IHSG sudah memuat hari bursa ≥ hari event, mode-nya retrospektif. Kalau belum, prospektif.
5. **Bukti (retrospektif).**
   - Jendela harga `priceWindow(hariEvent, hariIni)`: akhir jendela dibulatkan ke tanggal 15 atau akhir bulan, dengan batas hari ini. Awal jendela = akhir − 89 hari. Pembulatan ini supaya cache bisa dipakai bersama antar event.
   - `measureReaction()` menghitung: return harian, lalu AR = r_saham − r_IHSG. σ dihitung dari AR pada maksimal 40 hari bursa sebelum t0−1, dengan syarat minimal 20. CAR dihitung pada t0 sampai t0+5, atau sebanyak hari yang tersedia. z = CAR / (σ·√n). Reaksi dianggap signifikan kalau |z| ≥ 2.
   - `marketWide` = |return IHSG di t0| ≥ 2%.
   - Foreign flow: total `net_foreign_inflow` pada jendela event.
   - *Unexplained movers:* dihitung hanya kalau t0 adalah hari bursa terakhir di data. Isinya top losers 1 hari yang turun ≤ −5% dan tidak ada di daftar kandidat.
6. **Pola historis (prospektif, juga ditampilkan di retrospektif).** `findAnalogs()` mencari laporan retrospektif yang tersimpan dengan `event_type` sama dan subsektor yang beririsan. Hasilnya rata-rata CAR per subsektor beserta jumlah event.
7. **Laporan.** `scoreConfidence()` memberi tingkat keyakinan, lalu `narrate()` (LLM) menulis headline, rantai sebab-akibat, dan penjelasan per saham **dari bukti terstruktur saja**. Hasilnya dicek oleh penjaga kata. Laporan disimpan di `reports`, sehingga membuka laporan yang sama lagi memakai 0 kredit.

**Aturan tingkat keyakinan:**
- *Retrospektif:* `tinggi` kalau signifikan, tidak `marketWide`, dan jenis kaitan `direct`/`group`. `sedang` kalau signifikan saja. `rendah` untuk kondisi lainnya atau kalau data tidak cukup.
- *Prospektif:* `sedang` kalau ada ≥ 3 event historis dengan subsektor yang sama. Selain itu `rendah`. **Prospektif tidak pernah `tinggi`.**

## 6. Anggaran kredit

1.000 kredit adalah total per tim selama acara (tidak direset harian).

| Keperluan | Kredit |
|---|---|
| Development dan rekam fixture (satu orang, hasilnya di-commit) | 60 |
| Pustaka event historis (~15 event dengan jendela waktu berdekatan) | 120 |
| Polling otomatis (3×/hari pada hari bursa) | 30 |
| Analisis untuk uji dan demo (~20 event × rata-rata ~10) | 200 |
| Rekaman video demo | 50 |
| Cadangan | 150 |
| **Total rencana** | **~610** |

- Biaya analisis event pertama maksimal ~19 kredit. Event berikutnya di jendela waktu yang sama ~3–5 kredit.
- Sebelum analisis dijalankan, UI menampilkan *"maksimal ~19 kredit, lebih sedikit kalau data sudah di-cache"*. Laporan menampilkan kredit yang benar-benar terpakai (`creditsUsed`, dihitung dari ledger).
- **Batas:** di ≥ 80% budget, muncul banner peringatan dan polling berhenti. Di ≥ 90% budget, semua panggilan API asli diblokir (`CreditBudgetError`) dan aplikasi hanya memakai cache.

## 7. Penanganan error

| Kasus | Penanganan |
|---|---|
| Output LLM tidak valid terhadap skema | Coba ulang 1×. Kalau masih gagal, event diberi status `failed` dengan pesan "Gagal memahami berita, coba tempel teksnya atau ringkas beritanya" |
| LLM menyebut kode saham fiktif | Dibuang oleh `buildCandidates()` (validasi terhadap daftar emiten di cache, tanpa memanggil API) |
| Kandidat tanpa kaitan yang didukung data | Tidak mungkin terjadi: setiap `Candidate` punya `linkType` yang berasal dari data Sectors |
| Link gagal dibaca (paywall, 4xx/5xx, timeout 10 dtk, teks < 300 karakter) | `ArticleFetchError`, lalu UI meminta user menempel teks |
| Tanggal event tidak diketahui | Urutan fallback: input user, lalu meta `article:published_time`, lalu tanggal hari ini |
| Akhir pekan atau libur | Hari bursa pertama ≥ hari event diambil dari data IHSG, tanpa kalender libur |
| Sectors 429 | Retry dengan jeda 1 dtk, 2 dtk, 4 dtk (maks. 3×). Gratis |
| Sectors 5xx | Retry 1×. Kalau masih gagal, temuan saham itu diberi `dataNote` "data tidak tersedia" dan laporan tetap dibuat |
| Sectors 400 | Tidak di-retry. Dicatat ke log sebagai bug |
| Data harga kurang dari 20 hari estimasi (baru IPO, disuspensi) | `reaction = null`, keyakinan `rendah`, `dataNote` "data tidak cukup" |
| Kredit ≥ 80% / ≥ 90% | Lihat bagian 6 |
| Narasi mengandung kata terlarang | Dibuat ulang 1×, lalu diganti template netral kalau masih melanggar |
| Tidak ada event historis serupa | Menampilkan "Belum ada preseden serupa di pustaka kami" |

**Kata terlarang** (tidak peka huruf besar-kecil): `beli`, `jual`, `rekomendasi`, `target harga`, `pasti naik`, `pasti turun`, `wajib`, `buy`, `sell`, `hold`, `akumulasi sekarang`. Pengecualian: frasa data resmi `net jual asing` dan `net beli asing` boleh dipakai.

**Disclaimer (wajib tampil di setiap laporan):** *"Informasi ini adalah analisis data historis dan bukan saran investasi. Keterkaitan tidak berarti sebab-akibat. Keputusan investasi sepenuhnya tanggung jawab Anda."*

## 8. Testing

- **Vitest** untuk unit dan integration test, **Playwright** untuk 1 test E2E, dan **GitHub Actions CI** (typecheck, lint, test) di setiap push/PR.
- **Fixture sebagai default:** test berjalan dengan `SECTORS_MODE=fixture`. Kalau ada panggilan tanpa fixture, `FixtureMissingError` dilempar dan test gagal, jadi API asli tidak pernah dipanggil. `pnpm record` dijalankan sekali oleh satu orang, lalu hasilnya di-commit ke `fixtures/sectors/`.
- **Unit test:** fungsi `lib/market`, logika budget dan cache di klien, penjaga kata, keyakinan, penyusunan kandidat, dan analog.
- **Contract test:** skema zod divalidasi terhadap sampel dari dokumentasi (`fixtures/samples/`) dan terhadap semua fixture asli yang sudah direkam.
- **Integration test:** `analyzeEvent()` dengan `MarketData` palsu (seri harga sintetis) dan `LlmClient` palsu, lalu hasilnya dicek dengan snapshot laporan.
- **Golden set:** `data/golden-set.json` berisi 8–10 event nyata beserta label subsektor/saham yang diharapkan. `pnpm eval` dijalankan manual dengan LLM asli dan menghasilkan presisi/recall. Tidak dijalankan di CI.
- **E2E:** tempel teks, tunggu laporan tampil, lalu cek disclaimer. Juga memicu polling dan mengecek feed. Berjalan dengan data pasar sintetis (`SECTORS_MODE=fake`) dan LLM palsu (`LLM_MODE=fake`), tanpa kredit dan tanpa API key.

## 9. Konfigurasi (env)

| Variabel | Contoh | Keterangan |
|---|---|---|
| `SECTORS_API_KEY` | `sk-...` | Jangan pernah di-commit |
| `SECTORS_MODE` | `fixture` \| `record` \| `live` \| `fake` | Default `fixture`. `fake` = data pasar sintetis deterministik untuk dev UI dan E2E |
| `FAKE_SHOCK_DAY` | `2026-03-02` | Hanya untuk `fake`: tanggal ketika BBRI/BMRI sintetis "anjlok" |
| `SECTORS_CREDIT_BUDGET` | `1000` | |
| `OPENAI_API_KEY` | `sk-...` | |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model apa pun yang mendukung structured outputs |
| `LLM_MODE` | `openai` \| `fake` | `fake` untuk test dan E2E |
| `DATABASE_URL` | `file:local.db` | `libsql://...` untuk Turso |
| `DATABASE_AUTH_TOKEN` | | Hanya untuk Turso |
| `CRON_SECRET` | acak | Untuk `GET /api/cron/poll` |

## 10. Pengiriman dan demo

- Cron polling berjalan lewat **GitHub Actions schedule** (`0 1,5,9 * * 1-5` UTC, yaitu 08:00, 12:00, dan 16:00 WIB) yang memanggil `/api/cron/poll`. Cron Vercel Hobby hanya bisa sekali sehari. Kalau aplikasi tidak di-deploy, jalankan `pnpm poll` secara lokal.
- Deploy bersifat opsional (Vercel + Turso). Yang wajib: repo publik, video teaser 1 menit, video walkthrough maksimal 3 menit, dan post di media sosial.
- Skenario demo yang disiapkan dan di-cache: (1) event kebijakan/pidato yang berdampak ke saham BUMN, (2) berita global (tempel link) yang berdampak lewat subsektor, (3) satu event prospektif dengan pola historis.
