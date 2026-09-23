# Riset copywriting: hero, microcopy, dan istilah keuangan untuk orang awam

Tanggal: 2026-09-23. Konteks: Correlation Explainer (berita → saham BEI terkait → bukti reaksi pasar). Audiens: juri hackathon + orang Indonesia yang tidak paham saham.

Catatan metode: setiap klaim diberi URL sumber. Sumber yang tidak bisa diakses ditandai. Kutipan dari sumber berbahasa Inggris saya terjemahkan bebas; teks asli ada di URL. Beberapa halaman (Material Design, Apple HIG) dirender dengan JavaScript sehingga isi yang terbaca alat saya tidak bisa diverifikasi kata per kata; keduanya **tidak** dipakai sebagai dasar prinsip di dokumen ini.

---

## 1. Ringkasan prinsip kunci

1. **Hero harus menjawab "situs ini untuk apa" dalam ~10 detik.** Pengguna sering pergi dalam 10–20 detik; tagline harus menyebut dengan jelas apa yang dilakukan produk dan apa bedanya. Uji: kalau tagline dibalik maknanya dan tidak ada yang mau mengklaim kebalikannya, tagline itu kosong. ([NN/G, Tagline Blues](https://www.nngroup.com/articles/tagline-blues-whats-the-site-about/); [NN/G, Homepage Design Principles](https://www.nngroup.com/articles/homepage-design-principles/))
2. **Jual hasil untuk pengguna, bukan teknologinya.** "Powered by AI" bukan value proposition; sebutkan masalah yang diselesaikan, bukan cara (AI) menyelesaikannya. ([NN/G, "Powered by AI" Is Not a Value Proposition](https://www.nngroup.com/articles/powered-by-ai-is-not-a-value-proposition/))
3. **Bahasa sederhana untuk semua orang, termasuk ahli.** Profesional berpendidikan tinggi juga lebih suka teks ringkas dan mudah dipindai; teks yang jelas justru terlihat lebih kredibel. ([NN/G, Plain Language Is for Everyone, Even Experts](https://www.nngroup.com/articles/plain-language-experts/)) Kalimat aktif, kata kerja kuat, kalimat pendek. ([Digital.gov, Writing for understanding](https://digital.gov/guides/plain-language/writing))
4. **Istilah teknis boleh, asal dijelaskan saat pertama muncul; singkatan ditulis lengkap dulu.** ([GOV.UK A–Z style guide](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/); [Mailchimp, Grammar and mechanics](https://styleguide.mailchimp.com/grammar-and-mechanics/)) Untuk konteks keuangan Indonesia ini bahkan kewajiban bagi pelaku jasa keuangan: istilah sederhana dalam Bahasa Indonesia + penjelasan atas istilah/simbol yang belum dipahami konsumen. ([POJK 22/2023 Pasal 29 ayat 2 dan 4](https://peraturan.bpk.go.id/Download/362621/POJK%2022%20Tahun%202023%20Pelindungan%20Konsumen%20dan%20Masyarakat%20di%20Sektor%20Jasa%20Keuangan.pdf))
5. **Dua kata pertama menentukan.** Pengguna memindai dan sering hanya membaca ~2 kata awal label/judul; taruh kata bermakna di depan, hindari istilah buatan sendiri. ([NN/G, First 2 Words](https://www.nngroup.com/articles/first-2-words-a-signal-for-scanning/); [Microsoft Style Guide, Top 10 tips](https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice))
6. **Angka ditulis sebagai digit, satuan besar dengan kata.** Digit menonjol saat dipindai; untuk angka besar pakai "24 miliar", bukan deretan nol; jelaskan satuan yang tidak lazim. ([NN/G, Show Numbers as Numerals](https://www.nngroup.com/articles/web-writing-show-numbers-as-numerals/)) Format Indonesia: desimal koma, ribuan titik, "Rp5.000", "5%", boleh "500 ribu". ([EYD V, Angka dan Bilangan](https://ejaan.kemendikdasmen.go.id/eyd/penulisan-kata/angka-dan-bilangan/))
7. **Microcopy: jelas dulu, ringkas kedua, karakter ketiga.** ([NN/G, 3 C's of Informational Microcopy](https://www.nngroup.com/articles/3-cs-microcopy/)) Tombol diawali kata kerja yang menjelaskan hasilnya. ([NN/G, UI Copy](https://www.nngroup.com/articles/ui-copy/))
8. **Jujur soal batas AI.** Output AI yang tampil yakin membuat pengguna terlalu percaya; tampilkan sumber, pakai bahasa netral (bukan "saya berpikir…"), letakkan peringatan dekat tempat input, bukan di footer. ([NN/G, Explainable AI in Chat Interfaces](https://www.nngroup.com/articles/explainable-ai/)) Selaras dengan larangan informasi "tidak jelas, tidak akurat, … menyesatkan" di [POJK 22/2023 Pasal 29 ayat 1](https://peraturan.bpk.go.id/Download/362621/POJK%2022%20Tahun%202023%20Pelindungan%20Konsumen%20dan%20Masyarakat%20di%20Sektor%20Jasa%20Keuangan.pdf).

---

## 2. Hero landing page

### Aturan

- Kalimat utama menyebut **apa yang terjadi untuk pengguna**: tempel berita → lihat saham terkait → lihat buktinya. Jangan kalimat puitis yang bisa dipakai produk mana pun (uji "kebalikan" dan "tukar nama pesaing", [NN/G Tagline Blues](https://www.nngroup.com/articles/tagline-blues-whats-the-site-about/)). "Satu berita. Banyak jejak di harga." gagal uji ini: tidak menjelaskan apa yang dilakukan.
- Jangan jadikan "AI" sebagai judul. AI boleh disebut di subjudul sebagai *cara*, bukan *manfaat* ([NN/G](https://www.nngroup.com/articles/powered-by-ai-is-not-a-value-proposition/)).
- Tanpa janji hasil atau untung, tanpa "pasti", "terbaik", "bebas risiko". Satgas PASTI OJK menyebut klaim keuntungan tinggi/bebas risiko sebagai ciri promosi investasi bermasalah (liputan sekunder: [Bisnis.com, 18 Jun 2026](https://finansial.bisnis.com/read/20260618/563/1981564/satgas-pasti-setop-promosi-platform-investasi-ilegal-oleh-influencer); sumber primer OJK tidak saya temukan dalam waktu riset).
- Hindari kata kerja kausal ("berita ini *membuat* saham turun"): aplikasi mengukur keterkaitan, bukan sebab-akibat (sesuai `DISCLAIMER` di `lib/explain/guard.ts`).
- Satu CTA, diawali kata kerja, menyebut hasil ([NN/G UI Copy](https://www.nngroup.com/articles/ui-copy/)).
- Disclaimer pendek dekat kotak input, bukan hanya di footer ([NN/G Explainable AI](https://www.nngroup.com/articles/explainable-ai/)).
- Sentence case, tanpa titik di judul ([Microsoft Style Guide](https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice)).

### 3 alternatif

**Set A — langsung ke fungsi**
- Judul: **Ada berita ekonomi? Lihat saham mana yang ikut bergerak**
- Subjudul: Tempel tautan atau isi berita. Kami cari saham di Bursa Efek Indonesia yang berkaitan, lalu bandingkan geraknya dengan pasar selama 6 hari bursa.
- CTA: **Cek dampak berita**
- Rasional: tagline menyebut persis apa yang dilakukan dan lolos uji "kebalikan" ([NN/G Tagline Blues](https://www.nngroup.com/articles/tagline-blues-whats-the-site-about/)).

**Set B — menonjolkan bukti**
- Judul: **Dari berita ke harga saham, lengkap dengan buktinya**
- Subjudul: Cari tahu saham yang terkait sebuah berita, dan apakah geraknya memang tidak biasa dibanding pasar, bukan sekadar kebetulan.
- CTA: **Tempel berita**
- Rasional: manfaat bagi pengguna (bisa membedakan gerak biasa vs tidak biasa), bukan teknologi ([NN/G Powered by AI](https://www.nngroup.com/articles/powered-by-ai-is-not-a-value-proposition/)).

**Set C — pertanyaan yang dimiliki pengguna**
- Judul: **Berita ini berkaitan dengan saham apa?**
- Subjudul: Tempel berita apa pun. AI mencari saham yang terkait dan menjelaskan alasannya; data harga menunjukkan seberapa besar reaksinya. Ini analisis data, bukan saran investasi.
- CTA: **Analisis berita ini**
- Rasional: dua kata pertama ("Berita ini") langsung relevan saat dipindai ([NN/G First 2 Words](https://www.nngroup.com/articles/first-2-words-a-signal-for-scanning/)); AI disebut sebagai cara, batasnya disebut jujur ([NN/G Explainable AI](https://www.nngroup.com/articles/explainable-ai/)).

Semua set di atas bebas dari kata di `BANNED_PHRASES` (cek ulang dengan `findBannedPhrases()` sebelum dipakai).

---

## 3. Microcopy UI

### Panduan umum

| Elemen | Aturan | Sumber |
|---|---|---|
| Label | Kata bermakna di depan; istilah umum, bukan jargon/singkatan buatan ("CAR", "// BUKTI HARGA //"). Singkatan teknis hanya sebagai keterangan kedua. | [NN/G First 2 Words](https://www.nngroup.com/articles/first-2-words-a-signal-for-scanning/); [GOV.UK A–Z](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/) |
| Helper/tooltip | Satu kalimat, jelaskan istilah saat pertama muncul. | [NN/G 3 C's](https://www.nngroup.com/articles/3-cs-microcopy/); [POJK 22/2023 Ps. 29(4)](https://peraturan.bpk.go.id/Download/362621/POJK%2022%20Tahun%202023%20Pelindungan%20Konsumen%20dan%20Masyarakat%20di%20Sektor%20Jasa%20Keuangan.pdf) |
| Empty state | (1) katakan status, (2) beri petunjuk apa yang akan muncul, (3) beri jalan langsung ke aksi. Contoh: "Belum ada analisis. Tempel berita di atas untuk mulai. [Coba contoh berita]" | [NN/G Empty States](https://www.nngroup.com/articles/empty-state-interface-design/) |
| Loading | Tunjukkan status sistem per tahap, pakai bahasa pengguna: "Membaca berita…", "Mencari saham terkait…", "Mengambil data harga…", "Menyusun penjelasan…". | [NN/G Empty States (communicate system status)](https://www.nngroup.com/articles/empty-state-interface-design/) |
| Error | Dekat sumber masalah, bahasa awam tanpa kode error, spesifik, beri solusi, jangan menyalahkan ("tidak valid"), simpan input pengguna. Contoh: "Kami tidak bisa membuka tautan ini. Coba tempel isi beritanya langsung." | [NN/G Error Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/); [Microsoft](https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice) |
| Tombol | Kata kerja + hasil: "Analisis berita", "Lihat detail saham", "Coba contoh". Hindari "Lanjut"/"OK"/"Submit". | [NN/G UI Copy](https://www.nngroup.com/articles/ui-copy/) |
| Angka | Digit, desimal koma, tanda minus asli (−), "Rp120 miliar" bukan "120 M"; arah dijelaskan dengan kata ("turun 4,2%") bukan hanya tanda. | [NN/G Numerals](https://www.nngroup.com/articles/web-writing-show-numbers-as-numerals/); [EYD V](https://ejaan.kemendikdasmen.go.id/eyd/penulisan-kata/angka-dan-bilangan/); [GOV.UK: "always use million in money"](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/) |
| Keyakinan AI | Bahasa netral + sumber, bukan antropomorfis. "Berdasarkan: [judul berita]" lebih baik daripada "Saya yakin…". | [NN/G Explainable AI](https://www.nngroup.com/articles/explainable-ai/) |

**Jebakan `findBannedPhrases()`**: kata `beli`, `jual`, `wajib` berdiri sendiri akan ditolak. "Asing jual 120 M" gagal; "menjual", "dijual", "membeli" lolos (regex butuh batas non-huruf); "net jual asing"/"net beli asing" di-whitelist.

### Glosarium label

Definisi teknis dicek ke kode: CAR = jumlah return abnormal (return saham − return IHSG) dari T0 s.d. T+5; z = CAR / (σ·√N) dengan σ dari 20–40 hari bursa sebelum berita (`lib/market/reaction.ts`); keyakinan dihitung aturan, bukan oleh AI: tinggi = tidak biasa + disebut langsung/grup, sedang = tidak biasa tapi kaitan indeks/subsektor atau pasar bergerak serempak, rendah = tidak signifikan (`lib/explain/confidence.ts`).

| Istilah sekarang | Label utama (awam) | Helper text (≤ 12 kata) | Istilah teknis (sekunder) |
|---|---|---|---|
| T0 | Hari berita | Hari bursa pertama setelah berita terbit. | T0 |
| T+1…T+5 | Hari ke-1 s.d. ke-5 setelah berita | Dihitung hari bursa, tanpa akhir pekan dan libur. | T+1…T+5 |
| IHSG di T0 | Pasar secara umum di hari berita | Gerak rata-rata seluruh saham di Bursa Efek Indonesia. | IHSG (Indeks Harga Saham Gabungan) |
| CAR / abnormal return kumulatif | Selisih dengan pasar (6 hari) | Gerak saham dikurangi gerak IHSG, dijumlah selama 6 hari bursa. | Abnormal return kumulatif (CAR) |
| Nilai CAR, mis. −4,2% | "Turun 4,2% lebih dalam dari pasar" / "Naik 3,1% lebih tinggi dari pasar" | — | CAR −4,2% |
| z-score, signifikan (\|z\| ≥ 2) | **Tidak biasa** / **Masih wajar** | Jauh di luar gejolak normal saham ini 2 bulan terakhir. | z = −2,8 (ambang ±2) |
| Net asing | Investor asing: lebih banyak menjual / lebih banyak membeli | Selisih nilai transaksi investor luar negeri selama 6 hari. | Net sell / net buy asing |
| Nilai net asing, mis. −120 M | "Rp120 miliar lebih banyak dijual" | — | Net asing −Rp120 miliar |
| Kaitan: disebut langsung | Disebut di berita | Nama atau kode sahamnya muncul di teks berita. | Link type: direct |
| Kaitan: grup | Satu grup usaha | Perusahaan satu grup dengan yang disebut di berita. | Link type: group |
| Kaitan: indeks | Anggota indeks yang disebut | Termasuk indeks saham yang disebut, mis. LQ45. | Link type: index |
| Kaitan: subsektor | Bidang usaha yang sama | Bergerak di bidang usaha yang dibahas berita. | Link type: sector (subsektor) |
| Keyakinan tinggi | Bukti kuat | Gerak tidak biasa dan sahamnya terkait langsung. | Keyakinan: tinggi |
| Keyakinan sedang | Bukti sedang | Gerak tidak biasa, tapi kaitannya tidak langsung. | Keyakinan: sedang |
| Keyakinan rendah | Bukti lemah | Gerak saham masih dalam batas wajar. | Keyakinan: rendah |
| Pola historis | Yang terjadi di berita serupa sebelumnya | Rata-rata gerak dari berita sejenis yang pernah dianalisis. | Analog historis (n event, rata-rata CAR) |
| Belum terjelaskan | Bergerak tajam, belum ada penjelasan | Turun tidak biasa, tapi tidak terkait berita ini. | Unexplained movers |
| Mode RETROSPEKTIF | Reaksi pasar sudah terlihat | Berita sudah lewat; angka berasal dari harga sebenarnya. | Mode retrospektif |
| Mode HIPOTESIS | Dugaan: pasar belum bereaksi | Belum ada hari bursa setelah berita; ini perkiraan. | Mode prospektif (HIPOTESIS) |
| Kredit Sectors | Kuota data terpakai | Jumlah permintaan data harga ke Sectors untuk laporan ini. | Kredit API Sectors |

Catatan implementasi:
- Label "Keyakinan" sebaiknya diganti "Kekuatan bukti": nilainya dihitung aturan dari data, bukan tingkat yakin AI. Menyebutnya "keyakinan AI" berisiko menyesatkan ([NN/G Explainable AI](https://www.nngroup.com/articles/explainable-ai/)).
- Test sekarang mengecek `modeLabel('prospective')` mengandung "HIPOTESIS" dan headline prospektif diawali `HIPOTESIS`. Label "Dugaan" bisa dipakai di UI asal kata HIPOTESIS tetap ada, atau test diperbarui (keputusan tim).
- Kolom istilah teknis cocok ditaruh di tooltip/"Detail teknis" agar juri tetap melihat metodenya tanpa membebani awam ([GOV.UK: technical terms are fine if explained](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/)).
- Definisi IHSG: indeks yang menggambarkan pergerakan harga seluruh saham tercatat di BEI. Halaman IDX ([idx.co.id/id/produk/indeks](https://www.idx.co.id/id/produk/indeks/), [rdis.idx.co.id](https://rdis.idx.co.id/id/events/what-is-the-composite-stock-price-index)) **mengembalikan HTTP 403** ke alat saya; definisi diambil dari cuplikan hasil pencarian atas halaman tersebut, perlu dicek manual.
- Definisi net buy/sell asing: tidak ada halaman IDX yang bisa diakses; definisi di atas konsisten dengan kamus sekuritas (sekunder: [Maybank Sekuritas](https://www.maybanktrade.co.id/produk/kamus-investasi/net-foreign-buy/)).

---

## 4. Kepatuhan dan nada

### Dasar hukum (mengapa perlu hati-hati)

- **Nasihat jual-beli efek adalah kegiatan berizin.** "Penasihat Investasi adalah Pihak yang memberi nasihat kepada Pihak lain mengenai penjualan atau pembelian Efek dengan memperoleh imbalan jasa" dan hanya pihak berizin yang boleh melakukannya. ([UU 8/1995 Pasal 1 angka 14 dan Pasal 34 ayat 1, via pasal.id](https://pasal.id/peraturan/uu/uu-no-8-tahun-1995)) Aplikasi tidak berizin, jadi tidak boleh memberi arahan beli/jual/tahan.
- **Larangan pernyataan menyesatkan yang memengaruhi harga efek**, termasuk bila "tidak cukup hati-hati" menentukan kebenarannya. ([UU 8/1995 Pasal 93, via pasal.id](https://pasal.id/peraturan/uu/uu-no-8-tahun-1995/pasal-93)) Relevan untuk output AI: klaim kausal atau prediksi yang disajikan sebagai fakta berisiko.
- **Standar informasi OJK** (berlaku langsung untuk PUJK; untuk aplikasi ini dipakai sebagai patokan praktik baik): informasi harus "jelas, akurat, jujur, mudah diakses, dan tidak berpotensi menyesatkan"; istilah sederhana dalam Bahasa Indonesia; penjelasan atas istilah/simbol/diagram yang belum dipahami; risiko seperti "penurunan harga saham yang dibeli (capital loss)" termasuk informasi yang disampaikan. ([POJK 22/2023 Pasal 29 dan Penjelasannya](https://peraturan.bpk.go.id/Download/362621/POJK%2022%20Tahun%202023%20Pelindungan%20Konsumen%20dan%20Masyarakat%20di%20Sektor%20Jasa%20Keuangan.pdf); [FAQ POJK 22/2023, OJK](https://www.ojk.go.id/id/regulasi/Documents/Pages/Pelindungan-Konsumen-dan-Masyarakat-di-Sektor-Jasa-Keuangan/FAQ%20POJK%2022%20Tahun%202023%20Pelindungan%20Konsumen%20dan%20Masyarakat%20di%20Sektor%20Jasa%20Keuangan.pdf))
- **Jangan menyiratkan diawasi OJK dan jangan pakai logo OJK.** Pernyataan "berizin dan diawasi OJK" hanya untuk PUJK, dan logo OJK dilarang dicantumkan dalam pernyataan itu. ([POJK 22/2023 Pasal 35](https://peraturan.bpk.go.id/Download/362621/POJK%2022%20Tahun%202023%20Pelindungan%20Konsumen%20dan%20Masyarakat%20di%20Sektor%20Jasa%20Keuangan.pdf))

### Cara menulis agar jelas bukan saran

- Deskriptif, lampau, terukur: "Harga BBRI turun 4,2% lebih dalam dari pasar dalam 6 hari bursa setelah berita." Bukan: "BBRI akan terus turun."
- Kata keterkaitan, bukan sebab: "bergerak bersamaan", "terkait", "setelah berita". Hindari "karena berita ini", "memicu", "menyebabkan".
- Untuk mode hipotesis: "Pada berita serupa sebelumnya, saham di bidang ini rata-rata turun 2,1%. Ini bukan perkiraan harga." Hindari "berpotensi naik", "peluang", "saatnya".
- Tidak ada kata perintah kepada pengguna soal transaksi ("pertimbangkan untuk…", "segera…").
- Tampilkan sumber berita dan tanggal data di setiap laporan ([NN/G Explainable AI](https://www.nngroup.com/articles/explainable-ai/)).

### Kata/frasa yang dihindari

Sudah di `BANNED_PHRASES`: beli, jual, rekomendasi, target harga, pasti naik, pasti turun, wajib, buy, sell, hold, akumulasi sekarang.

Usulan tambahan (perlu persetujuan tim, cek dampak false positive): `untung`, `cuan`, `profit`, `pasti`, `dijamin`, `tanpa risiko`, `bebas risiko`, `peluang emas`, `saatnya`, `jangan sampai ketinggalan`, `saham pilihan`, `layak dikoleksi`, `undervalued`, `diskon`, `serok`, `take profit`, `cut loss`, `akan naik`, `akan turun`, `menyebabkan`, `memicu`. Dasar: klaim keuntungan/bebas risiko ([Satgas PASTI, via Bisnis.com — sekunder](https://finansial.bisnis.com/read/20260618/563/1981564/satgas-pasti-setop-promosi-platform-investasi-ilegal-oleh-influencer)) dan informasi menyesatkan ([POJK 22/2023 Ps. 29](https://peraturan.bpk.go.id/Download/362621/POJK%2022%20Tahun%202023%20Pelindungan%20Konsumen%20dan%20Masyarakat%20di%20Sektor%20Jasa%20Keuangan.pdf); [UU 8/1995 Ps. 93](https://pasal.id/peraturan/uu/uu-no-8-tahun-1995/pasal-93)).

### Teks disclaimer

**Pendek** (dekat kotak input dan di atas hasil; ≤ 20 kata):
> Ini analisis data harga masa lalu, bukan saran investasi. Saham yang terkait belum tentu dipengaruhi berita ini.

**Lengkap** (footer laporan / halaman "Tentang data"):
> Correlation Explainer menampilkan analisis data historis untuk tujuan edukasi. Aplikasi ini bukan penasihat investasi, tidak berizin atau diawasi OJK, dan tidak memberi saran untuk membeli, menjual, atau menahan saham apa pun. Keterkaitan antara berita dan pergerakan harga tidak berarti berita tersebut penyebabnya. Pergerakan di masa lalu tidak menjamin pergerakan di masa depan; harga saham bisa turun dan Anda bisa kehilangan modal. Penjelasan dibuat dengan bantuan AI dan bisa keliru; periksa sumber berita dan data aslinya. Keputusan investasi sepenuhnya tanggung jawab Anda.

Catatan: disclaimer lengkap memuat kata "membeli", "menjual", "menahan"; kata ini lolos regex (`beli`/`jual` diapit huruf), tapi tetap jalankan `findBannedPhrases()`. `DISCLAIMER` yang ada sekarang boleh dipertahankan sebagai versi menengah; mengubah konstanta itu tetap perlu persetujuan tim (aturan CLAUDE.md #3/#4 berlaku bila menyentuh kontrak).

---

## 5. Daftar sumber

Primer / first-party:
- NN/G — Plain Language Is for Everyone, Even Experts: https://www.nngroup.com/articles/plain-language-experts/
- NN/G — Tagline Blues: What's the Site About?: https://www.nngroup.com/articles/tagline-blues-whats-the-site-about/
- NN/G — Homepage Design: 5 Fundamental Principles: https://www.nngroup.com/articles/homepage-design-principles/ (dikutip via ringkasan hasil pencarian, halaman tidak dibuka langsung)
- NN/G — "Powered By AI" Is Not a Value Proposition: https://www.nngroup.com/articles/powered-by-ai-is-not-a-value-proposition/
- NN/G — First 2 Words: A Signal for the Scanning Eye: https://www.nngroup.com/articles/first-2-words-a-signal-for-scanning/
- NN/G — Show Numbers as Numerals: https://www.nngroup.com/articles/web-writing-show-numbers-as-numerals/
- NN/G — The 3 C's of Informational Microcopy: https://www.nngroup.com/articles/3-cs-microcopy/
- NN/G — The 3 I's of Microcopy: https://www.nngroup.com/articles/3-is-of-microcopy/
- NN/G — UI Copy: Command Names: https://www.nngroup.com/articles/ui-copy/ (via ringkasan hasil pencarian)
- NN/G — Designing Empty States in Complex Applications: https://www.nngroup.com/articles/empty-state-interface-design/
- NN/G — Error-Message Guidelines: https://www.nngroup.com/articles/error-message-guidelines/
- NN/G — Explainable AI in Chat Interfaces: https://www.nngroup.com/articles/explainable-ai/
- Digital.gov (penerus plainlanguage.gov) — Writing for understanding: https://digital.gov/guides/plain-language/writing
- GOV.UK — A to Z style guide: https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/
- Microsoft Writing Style Guide — Top 10 tips: https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice
- Mailchimp Content Style Guide — Grammar and mechanics: https://styleguide.mailchimp.com/grammar-and-mechanics/
- EYD V (Badan Bahasa) — Angka dan Bilangan: https://ejaan.kemendikdasmen.go.id/eyd/penulisan-kata/angka-dan-bilangan/
- POJK 22/2023 Pelindungan Konsumen dan Masyarakat di Sektor Jasa Keuangan (teks lengkap, JDIH BPK): https://peraturan.bpk.go.id/Download/362621/POJK%2022%20Tahun%202023%20Pelindungan%20Konsumen%20dan%20Masyarakat%20di%20Sektor%20Jasa%20Keuangan.pdf
- FAQ POJK 22/2023 (OJK): https://www.ojk.go.id/id/regulasi/Documents/Pages/Pelindungan-Konsumen-dan-Masyarakat-di-Sektor-Jasa-Keuangan/FAQ%20POJK%2022%20Tahun%202023%20Pelindungan%20Konsumen%20dan%20Masyarakat%20di%20Sektor%20Jasa%20Keuangan.pdf
- UU 8/1995 tentang Pasar Modal (via pasal.id; PDF resmi OJK dan JDIH Kemenkeu tidak bisa diunduh alat saya): https://pasal.id/peraturan/uu/uu-no-8-tahun-1995 dan https://pasal.id/peraturan/uu/uu-no-8-tahun-1995/pasal-93

Tidak bisa diakses (HTTP 403/404/DNS):
- IDX: https://www.idx.co.id/id/produk/indeks/ dan https://rdis.idx.co.id/id/events/what-is-the-composite-stock-price-index (403)
- GOV.UK "Use clear language" (404 setelah migrasi situs); Mailchimp "writing about money" (404); NN/G /articles/microcopy/ (404)
- JDIH Kemenkeu UU 8/1995 (DNS gagal); PDF UU 8/1995 di ojk.go.id (mengembalikan HTML, bukan PDF)

Sekunder (contoh saja, bukan dasar aturan):
- Bisnis.com, Satgas PASTI & influencer (18 Jun 2026): https://finansial.bisnis.com/read/20260618/563/1981564/satgas-pasti-setop-promosi-platform-investasi-ilegal-oleh-influencer
- Maybank Sekuritas, Kamus Investasi — Net Foreign Buy: https://www.maybanktrade.co.id/produk/kamus-investasi/net-foreign-buy/
- Produk ritel (Robinhood, Stockbit, Bibit, Pluang) tidak diteliti mendalam; tidak ada klaim di dokumen ini yang bergantung pada mereka.
