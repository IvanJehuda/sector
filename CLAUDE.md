# Correlation Explainer: Aturan untuk Coding Agent

Aplikasi Next.js 15 (TypeScript) untuk Sectors Hackathon 2026: berita/event → saham IDX terkait + bukti reaksi pasar.
Spec: docs/superpowers/specs/2026-09-22-correlation-explainer-design.md
Plan: docs/superpowers/plans/2026-09-22-correlation-explainer.md (riwayat; kode adalah sumber kebenaran)

## Mulai di sini
Baca **HANDOFF.md** dulu. Isinya status terkini, langkah berikutnya, anggaran kredit, dan risiko yang sengaja dibiarkan. Setelah menyelesaikan satu step, perbarui tabel status di HANDOFF.md §1.

## Perintah
- `pnpm test` (Vitest, fixture + fake LLM), `pnpm typecheck`, `pnpm lint`, `pnpm e2e`
- `pnpm dev` dengan `SECTORS_MODE=fake LLM_MODE=fake` untuk UI tanpa kredit

## Aturan wajib
1. JANGAN memanggil API Sectors asli dari test atau saat eksperimen. Pakai fixture (`fixtures/sectors/`) atau `SECTORS_MODE=fake`. Kredit melekat pada akun Sectors (600 per akun, tidak direset), bukan kolam tim. Sisa akun yang sedang dipakai tercatat di HANDOFF.md §4.
2. Semua akses Sectors lewat `lib/sectors/client.ts` (cache + pencatat kredit + batas budget). Jangan pernah memakai `fetch` langsung ke api.sectors.app.
3. `lib/domain.ts` adalah kontrak antar modul. Jangan mengubahnya tanpa persetujuan tim.
4. Tidak boleh ada saran investasi. Teks yang ditampilkan ke user wajib lolos `findBannedPhrases()` (lib/explain/guard.ts) dan menyertakan `DISCLAIMER`.
5. Modul kecil dengan satu tanggung jawab. Fungsi murni diletakkan di `lib/market`, `lib/explain`, dan `lib/history`.
6. TDD: tulis test dulu. Sebelum menyatakan selesai, jalankan `pnpm test && pnpm typecheck` dan tunjukkan hasilnya.
7. Teks UI dalam Bahasa Indonesia. Kode dan identifier dalam bahasa Inggris.
8. Jangan commit `.env*`, `*.db`, atau API key.
9. Perintah yang memakai kredit Sectors atau OpenAI (`pnpm record`, `pnpm seed:history`, `pnpm eval`, dan `pnpm dev` dengan `SECTORS_MODE=live`/`LLM_MODE=openai`) hanya boleh dijalankan setelah menyebutkan perkiraan kreditnya dan mendapat persetujuan eksplisit dari manusia.
