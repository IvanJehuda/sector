# Dugaan Dampak AI dan Tabel "Dampak per bidang usaha"

Status: disetujui di chat pada 4 Okt 2026 (bagian demi bagian). Spec ini merangkum desain yang disetujui.
Konteks: `docs/superpowers/specs/2026-09-22-correlation-explainer-design.md` §§2, 6 (mode prospektif dan pola historis).

## 1. Masalah

Pengguna bertanya apakah mode HIPOTESIS bisa memprediksi saham akan naik atau turun. Prediksi harga per saham **tidak** dilakukan:
- CLAUDE.md aturan 4 melarang saran investasi. "BBRI diprediksi turun" dibaca pengguna sebagai "jual BBRI".
- Spec utama menyebut mode HIPOTESIS "bukan perkiraan harga".
- Belum ada bukti akurasi arah. Golden set hanya mengukur saham yang terkait, dan pustaka pola historis baru berisi 12 laporan.

Yang dilakukan adalah dua hal yang aman dan berbasis data yang **sudah ada**:
1. **Dugaan mekanisme dampak dari AI per subsektor.** `extractEventProfile()` sudah menghasilkan `hypotheses` (`sub_sector`, `direction`, `reason`), tetapi saat ini datanya dibuang dan tidak disimpan ke laporan.
2. **Kecenderungan historis per subsektor** (`analogs`), yang sudah tersimpan, ditampilkan bersebelahan dengan dugaan AI dan reaksi nyata.

Tidak ada panggilan Sectors atau OpenAI baru. Biaya tambahan: nol.

## 2. Keputusan yang sudah diambil

| Keputusan | Pilihan |
|---|---|
| Jenis informasi arah | Kecenderungan historis + dugaan mekanisme AI. Bukan prediksi per saham. |
| Perubahan `lib/domain.ts` (aturan 3) | Disetujui Ivan atas nama tim: satu tipe baru dan satu field **opsional**. |
| Cakupan | Laporan retrospektif **dan** HIPOTESIS. |
| Pendekatan tampilan | Satu tabel gabungan "Dampak per bidang usaha" (pendekatan A). |
| Kata untuk arah | `negatif` → **Tekanan**, `positif` → **Dorongan**, `tidak jelas` → **Belum jelas**. Tidak memakai "akan naik/turun". |
| Label "AI tepat/tidak tepat" | Tidak dibuat. Dugaan dan kenyataan cukup ditampilkan berdampingan, dan pembaca menilai sendiri. |

## 3. Data dan pipeline

**Kontrak** (`lib/domain.ts`):
```ts
export type ImpactDirection = 'negatif' | 'positif' | 'tidak jelas';
export interface SubSectorHypothesis { subSector: string; direction: ImpactDirection; reason: string }
// di interface Report:
hypotheses?: SubSectorHypothesis[];
```
Field ini opsional, sehingga laporan yang sudah tersimpan tetap valid tanpa migrasi.

**Penyaringan** (`lib/explain/hypotheses.ts`, fungsi murni): `toReportHypotheses(profileHypotheses)`:
- memetakan `sub_sector` ke `subSector`;
- memangkas spasi pada `reason` dan membuang dugaan yang `reason`-nya kosong;
- membuang dugaan yang `reason`-nya mengandung kata terlarang (`findBannedPhrases`, aturan 4);
- menyimpan satu dugaan per subsektor (yang pertama), dicocokkan tanpa membedakan huruf besar.

**Penyimpanan** (`lib/pipeline/analyze.ts`, perakitan `Report`): tambahkan `hypotheses: toReportHypotheses(profile.hypotheses)`. Nama subsektor dari profil sudah dikanonisasi ke daftar universe oleh `extractEventProfile`.

## 4. Tampilan

**Fungsi murni** (`lib/ui/impact.ts`):
- `IMPACT_LABEL: Record<ImpactDirection, string>` = Tekanan / Dorongan / Belum jelas.
- `buildImpactRows(report)` menggabungkan `hypotheses ?? []`, `subSectorSummary`, dan `analogs` menjadi satu baris per subsektor (`subSector`, `hypothesis | null`, `actual | null`, `history | null`). Penggabungan dilakukan tanpa membedakan huruf besar, dengan nama tampilan dari sumber pertama yang memuatnya.
- Urutan baris: subsektor yang punya dugaan AI (sesuai urutan AI), lalu yang punya reaksi nyata (jumlah saham terbanyak dulu), lalu yang hanya punya pola historis.
- Di mode prospektif, `actual` selalu `null`.

**Komponen** (`components/ImpactTable.tsx`), judul "Dampak per bidang usaha":
- Kolom: Bidang usaha | Dugaan AI | Kenyataan | Berita serupa sebelumnya.
- **Dugaan AI**: tag label arah (garis putus-putus ungu, gaya penanda HIPOTESIS yang ada) diikuti alasannya, atau "—".
- **Kenyataan** (hanya retrospektif): "turun 3,2% lebih dalam dari pasar · 4 saham" dengan warna `tone()`, atau "—".
- **Berita serupa sebelumnya**: "3 berita · rata-rata …", atau "Belum ada".
- Catatan kaki: "Dugaan AI disusun dari isi berita, bukan perkiraan harga. Masa lalu tidak menjamin gerak berikutnya."
- Kolom "Dugaan AI" dan kalimat pertama catatan kaki disembunyikan bila tidak ada satu pun dugaan (laporan lama).
- Bila tidak ada baris sama sekali: "Belum ada data per bidang usaha."
- Di ponsel, setiap baris tampil sebagai kartu bertumpuk.

**Penempatan** (`components/ReportView.tsx`):
- Retrospektif: tabel menggantikan kolom "Per bidang usaha" dan "Berita serupa sebelumnya" di bagian bawah. Blok "Turun tajam, belum ada penjelasan" tetap ada.
- HIPOTESIS: tabel ditempatkan tepat setelah strip ringkasan, sebelum daftar saham.

Semua teks baru wajib lolos `findBannedPhrases()` dan berbahasa Indonesia (aturan 4 dan 7).

## 5. Kasus tepi

| Situasi | Perilaku |
|---|---|
| Laporan lama tanpa `hypotheses` | Tabel dibangun dari reaksi dan pola historis. Kolom dugaan disembunyikan. |
| Dugaan AI untuk subsektor tanpa saham atau data historis | Baris tetap tampil dengan "—". |
| `reason` berisi kata terlarang | Dugaan dibuang saat disimpan. |
| "banks" vs "Banks" | Digabung jadi satu baris. |
| Dua dugaan untuk subsektor yang sama | Yang pertama dipakai. |
| Arah `tidak jelas` | Label "Belum jelas" beserta alasannya. |

## 6. Pengujian (0 kredit)

- `tests/explain/hypotheses.test.ts`: pemetaan format, penyaringan kata terlarang, `reason` kosong, satu dugaan per subsektor.
- `tests/ui/impact.test.ts`: penggabungan dan urutan, `actual` kosong di prospektif, laporan tanpa dugaan, label arah lolos `findBannedPhrases`.
- `tests/pipeline/analyze.test.ts`: `report.hypotheses` tersimpan dari profil; dugaan dengan kata terlarang tidak ikut.
- e2e retrospektif: baris Banks menampilkan "Tekanan" dan alasannya, berdampingan dengan kolom "Kenyataan".
- e2e HIPOTESIS: teks tempelan dengan tanggal di masa depan (`2099-01-05`) menghasilkan laporan HIPOTESIS dengan tabel di atas daftar saham dan tanpa kolom "Kenyataan". Tanggal masa depan dipakai supaya hasilnya deterministik. Data IHSG palsu memuat setiap hari kerja sampai hari ini, sehingga teks tanpa tanggal yang diuji pada hari kerja sebelum pukul 16.00 WIB justru menjadi retrospektif. Untuk tanggal masa depan, `firstTradingDayOnOrAfter` selalu `null`.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`, `pnpm build`.

## 7. Di luar cakupan

- Prediksi naik/turun atau angka target per saham.
- Penilaian otomatis apakah dugaan AI tepat.
- Mengisi ulang dugaan AI untuk laporan lama (butuh analisis ulang dan kredit).
