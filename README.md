# Correlation Explainer

> *Correlation Explainer mengubah berita dan event apa pun menjadi daftar saham IDX yang terkait, beserta bukti reaksi pasar dari data Sectors, sehingga investor pemula paham "apa hubungannya berita ini dengan saham itu" tanpa menerima saran investasi.*

Sectors Hackathon 2026 · Track: **AI Agents & Assistants**

> **Melanjutkan pengembangan?** Baca [HANDOFF.md](HANDOFF.md) untuk status, langkah berikutnya, dan anggaran kredit.

**Disclaimer:** Informasi ini adalah analisis data historis dan bukan saran investasi. Keterkaitan tidak berarti sebab-akibat. Keputusan investasi sepenuhnya tanggung jawab Anda.

## Fitur
- **Penerima berita otomatis:** berita IDX dari Sectors ditarik 3× sehari pada hari bursa. Analisis berjalan saat diklik.
- **Tempel link atau teks:** berita apa pun (termasuk makro dan geopolitik) dipetakan ke saham IDX.
- **Retrospektif:** abnormal return dibanding IHSG, uji signifikansi (z-score), foreign flow, dan ringkasan per subsektor.
- **Prospektif (HIPOTESIS):** keterkaitan dan pola historis dari event serupa.
- **Hemat kredit:** cache-first, fixture, dan batas budget yang tegas (peringatan 80%, blokir 90%).

## Arsitektur
Next.js 15 + TypeScript · SQLite/libSQL · OpenAI structured outputs · Sectors REST API v2.
Detail: `docs/superpowers/specs/2026-09-22-correlation-explainer-design.md`.

| Data Sectors yang dipakai | Endpoint |
|---|---|
| Daftar emiten, grup usaha, dan anggota indeks | `/v2/companies/` (screener) |
| Afiliasi grup | `/v2/company/report/{symbol}/?sections=overview` |
| Harga saham dan IHSG | `/v2/daily/{symbol}/`, `/v2/index-daily/ihsg/` |
| Foreign flow | `/v2/foreign-flow/{symbol}/` |
| Top losers | `/v2/companies/top-changes/` |
| Feed berita | `/v2/news/` |

## Menjalankan
```bash
# pnpm wajib terpasang, mis. `npm i -g pnpm@9` atau `corepack enable`
pnpm install
cp .env.example .env.local        # isi SECTORS_API_KEY dan OPENAI_API_KEY
# Tanpa kredit dan tanpa LLM (data palsu):
SECTORS_MODE=fake LLM_MODE=fake FAKE_SHOCK_DAY=2026-03-02 pnpm dev
# Dengan data asli:
SECTORS_MODE=live LLM_MODE=openai pnpm dev
```

| Perintah | Fungsi |
|---|---|
| `pnpm test` / `pnpm e2e` | Unit/integration test (fixture) / E2E (mode palsu) |
| `pnpm record` | Rekam fixture asli (sekali, ~15–20 kredit) |
| `pnpm poll` | Tarik berita baru secara manual |
| `pnpm seed:history --tag <slug> --since YYYY-MM-DD --limit 15` | Bangun pustaka pola historis |
| `pnpm eval` | Presisi/recall pemetaan pada golden set |

## Aturan kredit tim (1.000 total)
Anggaran ada di spec §6. Pemakaian bisa dilihat di banner beranda dan `GET /api/credits`. **Jangan memanggil API asli dari test.**

Analisis baru dari pengunjung (`POST /api/analyze`) dibatasi: ditolak (HTTP 429) bila kredit terpakai sudah mencapai `PUBLIC_ANALYSIS_BUDGET_RATIO` × anggaran (default 0,7 — sisa 30% untuk seed histori dan demo) atau bila sudah ada `PUBLIC_ANALYSIS_DAILY_LIMIT` analisis dalam 24 jam terakhir (default 20). Membuka laporan yang sudah ada selalu diizinkan.

Tag berita (hasil `pnpm record`, 23 Sep 2026): slug untuk seed histori = `politics-regulation` (juga relevan: `government-policy`, `ministry`, `ojk`, `central-bank`, `interest-rate`, `tariff-vat`, `subsidies-incentives`). Daftar lengkap ada di `fixtures/sectors/v2_tags__*.json`.

## Golden set
`data/golden-set.json` berisi 8–10 event nyata dengan subsektor dan saham yang diharapkan (diberi label oleh tim). Hasil terakhir: `belum diisi — jalankan pnpm eval dengan API key`

## Deploy (opsional)
1. `turso db create correlation-explainer`, lalu ambil URL dan token.
2. Vercel: import repo, lalu set env `DATABASE_URL=libsql://...`, `DATABASE_AUTH_TOKEN`, `SECTORS_MODE=live`, `SECTORS_API_KEY`, `LLM_MODE=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `CRON_SECRET`, dan opsional `PUBLIC_ANALYSIS_DAILY_LIMIT` / `PUBLIC_ANALYSIS_BUDGET_RATIO` (lihat `.env.example`).
3. GitHub → Settings → Secrets: `APP_URL` (URL Vercel) dan `CRON_SECRET` untuk workflow `poll-news`.
