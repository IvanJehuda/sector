# Hitung Ulang Laporan HIPOTESIS dan Kolom Harga yang Disembunyikan

Status: desain disetujui di chat pada 5 Okt 2026 (Ivan). Spec ini merangkum desain itu.
Konteks: `docs/superpowers/specs/2026-09-22-correlation-explainer-design.md` (mode retrospektif dan prospektif), `lib/pipeline/auto.ts` (analisis otomatis).

## 1. Masalah

Laporan dibuat HIPOTESIS kalau belum ada sesi bursa yang tutup setelah berita terbit. Kebanyakan berita Sectors terbit sore, malam, atau akhir pekan, jadi laporan yang dibuat sebelum sesi berikutnya tutup selalu HIPOTESIS. Per 5 Okt, keenam laporan di "Laporan terbaru" beranda bertipe HIPOTESIS (36 saham, semuanya tanpa data harga).

`analyzeEvent` mengembalikan laporan tersimpan tanpa menghitung ulang, sehingga laporan HIPOTESIS tetap kosong selamanya walaupun data harganya sudah ada. Di tabel saham, kolom "Dibanding pasar" lalu tampil "Belum ada data harga" di setiap baris, dan pengguna awam membacanya sebagai error.

## 2. Keputusan

| Keputusan | Pilihan |
|---|---|
| Cara memperbarui | Analisis ulang penuh lewat pipeline yang ada, bukan menempel angka ke laporan lama. Penjelasan AI, tabel dampak, dan dugaan AI ikut diperbarui sehingga tidak bertentangan dengan angka. |
| Prioritas kredit | Hitung ulang didahulukan. Tiap panggilan cron: hitung ulang 1 laporan kalau ada; kalau tidak, analisis 1 berita kebijakan baru seperti sekarang. |
| Batas kredit | Penjaga yang sama dengan analisis publik (`publicAnalysisBlockReason`: batas harian dan rasio anggaran). Tidak ada anggaran terpisah. |
| Laporan retrospektif | Tidak pernah ditimpa. |
| Kolom harga | Disembunyikan bila tidak ada satu pun saham dengan data reaksi. |

## 3. Pemilihan laporan

**Data** (`lib/db/repo.ts`): `listProspectiveReports(db)` mengembalikan `{ eventId, publishedAt }` untuk setiap laporan `mode = 'prospective'` yang event-nya berstatus `done`.

**Percobaan terakhir** disimpan di tabel `kv` dengan kunci `remeasure:<eventId>` dan nilai tanggal WIB (`YYYY-MM-DD`). Nilai ini ditulis sebelum analisis ulang dimulai, sehingga percobaan yang gagal atau yang tetap menghasilkan HIPOTESIS (misalnya libur bursa) tidak diulang di hari yang sama.

**Fungsi murni** (`lib/events/remeasure-pick.ts`): `pickRemeasure(candidates, today)`, dengan `candidates: { eventId, publishedAt, lastAttempt: string | null }[]`. Sebuah kandidat layak bila:
- `eventCalendarDate(publishedAt)` bisa dibaca;
- hari kerja pertama pada atau setelah tanggal itu **sebelum** `today` (sesinya sudah tutup), sama dengan aturan `pickAutoAnalysis`;
- `lastAttempt !== today`.

Dari yang layak, dipilih yang hari beritanya paling baru (yang tampil di beranda didahulukan). Hasilnya `eventId` atau `null`. `firstWeekdayOnOrAfter` dipindah dari `lib/events/auto-pick.ts` ke `lib/market/dates.ts` lalu diekspor, agar dipakai kedua pemilih.

## 4. Menjalankan ulang

`analyzeEvent(eventId, deps, options?)` mendapat `options.refresh?: boolean`:
- Tanpa `refresh`, perilaku tetap: laporan yang ada dikembalikan apa adanya.
- Dengan `refresh` dan laporan tersimpan bermode `retrospective`: laporan itu dikembalikan apa adanya (tidak pernah ditimpa).
- Dengan `refresh` dan laporan bermode `prospective`: analisis penuh dijalankan dan `saveReport` (INSERT OR REPLACE) menimpanya.
- Bila analisis ulang gagal, status event dikembalikan ke `done` (laporan lama masih ada), bukan `failed`, supaya laporan tidak hilang dari beranda. Error tetap dilempar ke pemanggil untuk dicatat.

Selama analisis ulang, status event `analyzing`; halaman laporan tetap menampilkan laporan lama (halaman berhenti polling begitu laporan ada), dan laporan sementara tidak muncul di "Laporan terbaru" (±30 detik).

## 5. Penjadwalan

`claimAutoAnalysis` di `lib/pipeline/auto.ts` diperluas:
1. Ambil kandidat hitung ulang (`listProspectiveReports` + `kv`), lalu `pickRemeasure`.
2. Kalau ada: cek penjaga, tulis `remeasure:<id> = today`, klaim lewat `claimEventForAnalysis`, kembalikan `{ eventId, refresh: true }`.
3. Kalau tidak ada: perilaku lama (`pickAutoAnalysis`), kembalikan `{ eventId }`.

`/api/cron/analyze` meneruskan `refresh` ke `analyzeEvent`. Workflow `poll-news` tidak berubah.

Kunci `remeasure:` ditulis setelah penjaga lolos dan sebelum klaim; klaim yang kalah (`claimed-elsewhere`) tetap menghabiskan percobaan hari itu. Ini disengaja: lebih baik menunda satu hari daripada memakai kredit dua kali.

## 6. Tampilan

Fungsi murni `showReactionColumns(findings)` di `lib/ui/present.ts`: `true` bila setidaknya satu finding punya `reaction`.

Di `components/ReportView.tsx`, tabel saham (judul kolom dan setiap `FindingRow`):
- `true`: lima kolom seperti sekarang; baris tanpa reaksi menampilkan "—" di "Dibanding pasar" (bukan "Belum ada data harga").
- `false`: kolom "Dibanding pasar" dan "Gerak" tidak dirender; grid memakai string kelas Tailwind utuh lain dengan tiga kolom.

Catatan per saham (`dataNote`) di bagian yang bisa dibuka tetap tampil.

## 7. Kasus tepi

| Situasi | Perilaku |
|---|---|
| Berita Jumat malam, sekarang Sabtu/Minggu | Belum layak (hari kerja pertama = Senin, belum lewat). |
| Libur bursa di hari kerja | Analisis ulang tetap HIPOTESIS; dicoba lagi besok (kunci `remeasure:` mencegah ulangan hari yang sama). |
| Analisis ulang gagal (Sectors/OpenAI error) | Status kembali `done`, laporan lama tetap tampil; dicoba lagi besok. |
| Kuota publik habis | `{ skipped: 'blocked' }`, tidak ada kredit terpakai, kunci `remeasure:` tidak ditulis. |
| Laporan retrospektif | Tidak pernah dipilih (bukan `prospective`), dan `refresh` tidak menimpanya. |
| Sebagian saham punya data harga | Kolom tampil; yang kosong menampilkan "—". |

## 8. Pengujian (0 kredit)

- `tests/events/remeasure-pick.test.ts`: sesi sudah lewat vs belum, akhir pekan, sudah dicoba hari ini, tanggal tak terbaca, urutan terbaru dulu.
- `tests/pipeline/analyze.test.ts`: `refresh` mengubah HIPOTESIS jadi retrospektif ketika data harga tersedia; `refresh` tidak menimpa retrospektif; kegagalan saat `refresh` mengembalikan status `done`.
- `tests/pipeline/auto.test.ts`: hitung ulang didahulukan; kunci `remeasure:` ditulis; penjaga memblokir tanpa menulis kunci; fallback ke berita baru.
- `tests/ui/present.test.ts`: `showReactionColumns`.
- e2e: laporan HIPOTESIS tidak menampilkan judul kolom "Dibanding pasar".
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`, `pnpm build`.

## 9. Di luar cakupan

- Mengubah jadwal workflow atau menambah anggaran kredit.
- Menghitung ulang lebih dari satu laporan per panggilan.
- Mengenali hari libur bursa dari data IHSG.
