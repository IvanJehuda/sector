# Rencana redesain UI: gaya OpenScale + pola dari Mobbin

Status: draf untuk didiskusikan tim. Belum ada kode yang diubah.
Sumber: openscale.so (dicek 23 Sep 2026), Mobbin web screens untuk "stock analysis" dan "market news" (Perplexity Finance, Origin, Quicken, Rox).

## 1. Arah besar

UI sekarang masih polos: latar putih, font Arial, kartu dengan border abu-abu. Arah barunya **"terminal riset yang tenang"**:
- Tampilan gelap dengan garis tipis dan label monospace, seperti OpenScale. Kesannya teknis, presisi, dan bisa dipercaya. Cocok untuk produk yang menjual *bukti data*, bukan hype.
- Susunan halaman laporan mengikuti Perplexity Finance dan Origin: angka dan tabel di kiri, narasi AI di kanan.
- Tidak ada warna mencolok selain hijau dan merah untuk naik dan turun, plus satu aksen untuk mode HIPOTESIS.

## 2. DNA visual OpenScale (hasil inspeksi CSS)

| Elemen | Nilai di OpenScale | Pakai di kita |
|---|---|---|
| Latar halaman | `#08090B` | `--bg` |
| Permukaan kartu | `#121212`, `#1A1A1A` | `--surface`, `--surface-2` |
| Garis | `rgba(255,255,255,.08)` (biasa), `.2` (tegas) | `--line`, `--line-strong` |
| Teks | `#EDEDED`; redup `rgba(255,255,255,.5)` | `--fg`, `--fg-muted` |
| Font isi | Inter Variable 16/24 | Inter (via `next/font`) |
| Font judul | Stack Sans Notch 200–300, 44–56px | Inter atau Geist **weight 300**, besar, tracking rapat |
| Font label dan angka | Geist Mono 12px, uppercase, `letter-spacing .04em` | Geist Mono, juga untuk semua angka (`tabular-nums`) |

Motif yang layak ditiru, diurutkan dari yang paling murah dibuat:
1. **Label section bergaya `// MODELS & PRICING //`**: mono, kapital, kecil, di tengah di atas judul. Contoh untuk kita: `// RANTAI SEBAB-AKIBAT //`, `// BUKTI HARGA //`.
2. **Bingkai konten dengan garis vertikal kiri-kanan dan tanda `+` di sudut.** Seluruh halaman terasa seperti lembar kerja teknis.
3. **Pemisah arsir `//////////`** di antara section.
4. **Kartu "struk" monospace** (kotak PAYMENTS berisi baris `1M tokens ....... $0.39`). Sangat cocok untuk **pemakaian kredit Sectors** dan **ringkasan CAR per saham**.
5. **Tombol kotak dengan border 1px** dan penanda sudut. Tidak pakai sudut bulat besar.
6. **Cahaya gradasi spektrum di pojok hero** plus tekstur ASCII halus. Opsional, cukup CSS `radial-gradient`, tanpa library.

## 3. Pola dari Mobbin

- **Perplexity Finance, tab Analysis:** tabel data di kiri dan kolom "synthesis" berisi prosa di kanan, lalu input "Ask anything" di bawah. Dipakai untuk halaman laporan: tabel saham terkait di kiri, narasi dan rantai sebab-akibat di kanan.
- **Origin (stats saham):** strip KPI di atas (Mkt cap, P/E, EPS…) dengan label mono kecil dan angka besar, lalu bar horizontal untuk rating. Dipakai untuk strip "Kondisi pasar": T0, IHSG, jumlah saham signifikan, kredit.
- **Quicken (holdings):** grafik harga di samping grid statistik. Dipakai untuk kartu per saham: sparkline harga di sekitar event plus angka CAR, z, dan net asing.
- **Rox (laporan AI):** daftar bernomor "Recommendations" lalu blok "Key assumptions & next steps". Dipakai untuk rantai sebab-akibat bernomor dan blok "Catatan data/keterbatasan". Blok ini juga memperkuat disclaimer.

## 4. Rancangan halaman

### Beranda (`app/page.tsx`)
```
[nav]  Correlation Explainer            Feed   Cara kerja   [Sisa kredit 983]
------------------------------------------------------------------------------
                       // SECTORS HACKATHON 2026 //
           Berita masuk. Saham bergerak.
           Buktinya ada di sini.                       (judul weight 300, 56px)
      Tempel berita atau link. Kami cari saham IDX yang terkait dan
      cek reaksi harganya dibanding IHSG.
   +--------------------------------------------------------------+
   | > tempel teks atau URL berita…                     [tanggal] |
   |                                        [ Analisis berita -> ]|
   +--------------------------------------------------------------+
//////////////////////////////////////////////////////////////////////////////
 // FEED BERITA //
 TANGGAL      JUDUL                                   STATUS     SAHAM
 2026-09-21   Kebijakan dividen BUMN …                SELESAI    BBRI BMRI  ->
 2026-09-20   Tarif impor baja …                      BARU       —          ->
```
- Form menjadi "command box" besar di hero, karena itu aksi utamanya.
- Feed ditampilkan sebagai tabel baris (tanggal mono, status sebagai tag), bukan kartu.
- CreditBanner pindah ke nav sebagai angka kecil. Detailnya dibuat sebagai kartu struk di footer.

### Laporan (`app/events/[id]/page.tsx` + `ReportView`)
```
 [RETROSPEKTIF] / [HIPOTESIS]            // LAPORAN KORELASI //
 Judul headline (weight 300, 40px)
 Berita: judul (link)
 +-----------+-----------+-------------+-------------+
 | T0        | IHSG      | SIGNIFIKAN  | KREDIT      |   <- strip KPI ala Origin
 | 2026-03-02| -1,20%    | 2 / 5 saham | 19          |
 +-----------+-----------+-------------+-------------+
 +---------------------------------+  +---------------------------+
 | // BUKTI HARGA //               |  | // RANTAI SEBAB-AKIBAT // |
 | bar CAR vs IHSG (tema gelap)    |  | 01 Kebijakan …            |
 | tabel: SIMBOL NAMA CAR z ASING  |  | 02 Laba bank …            |
 |  BBRI  -4,1%  -2,8  jual 120 M  |  | 03 Investor asing …       |
 |  (klik baris = penjelasan)      |  | // CATATAN DATA //        |
 +---------------------------------+  | Disclaimer (selalu tampil)|
                                       +---------------------------+
 //////////  Ringkasan subsektor · Pola historis · Belum terjelaskan · Kaitan lain
 [struk kredit]  SECTORS API ......... 19 kredit / DIBUAT ....... 2026-09-23 08:41 UTC
```
- Dua kolom di desktop, satu kolom di ponsel. Kolom kanan sticky.
- Mode HIPOTESIS memakai tag berwarna aksen (ungu redup) dan garis kiri putus-putus di seluruh laporan, supaya jelas ini bukan fakta.
- Grafik recharts memakai tema gelap: grid `--line`, sumbu mono, batang hijau dan merah redup.

## 5. Token warna tambahan
- Naik `#3FB950`, turun `#F85149` (redup, kontras cukup di latar gelap)
- Aksen hipotesis `#A371F7`, peringatan pasar luas `#D29922`
- Semua angka persen memakai `tabular-nums` dan font mono

## 6. Langkah implementasi (tanpa dependensi baru)
1. `app/globals.css`: token di atas + `@theme` Tailwind v4, lalu hapus media query terang. Font diambil lewat `next/font/google` (Inter, Geist Mono).
2. Tiga komponen kecil: `SectionLabel` (`// X //`), `Frame` (bingkai + penanda sudut), `Receipt` (baris struk mono). Tidak perlu lebih dari itu.
3. Restyle `page.tsx`, `AnalyzeForm`, `Feed` (jadi tabel), dan `CreditBanner`.
4. Restyle `ReportView`: strip KPI, dua kolom, tabel temuan, tema gelap recharts.
5. Cek `pnpm e2e`, karena test E2E mencari teks label. Jangan ubah teks yang dipakai test tanpa memperbarui test-nya.
6. Screenshot dengan mode palsu untuk video.

## 7. Batasan yang tidak boleh dilanggar
- `DISCLAIMER` tetap terlihat di laporan (CLAUDE.md aturan 4). Posisinya dipindah ke kolom kanan, jangan disembunyikan.
- Semua teks UI dalam Bahasa Indonesia.
- Tidak menambah library animasi atau ikon. Cukup CSS.
- Perkiraan waktu: sekitar 1 hari kerja. Tenggat 30 Sep, jadi kerjakan setelah Step 4 dan 5 atau secara paralel oleh anggota lain.
