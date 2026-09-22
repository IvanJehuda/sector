# AGENTS.md

Instruksi untuk coding agent apa pun (Codex, Cursor, Copilot, Claude, dan lain-lain).

1. Baca **HANDOFF.md**: status, langkah berikutnya, dan anggaran kredit.
2. Ikuti **CLAUDE.md**: perintah proyek dan aturan wajib. Aturan itu berlaku untuk semua agent, bukan hanya Claude.
3. Spec (acuan utama): `docs/superpowers/specs/2026-09-22-correlation-explainer-design.md`.

Perintah verifikasi sebelum menyatakan selesai: `pnpm test && pnpm typecheck` (dan `pnpm lint && pnpm build && pnpm e2e` kalau menyentuh `app/`, `components/`, atau konfigurasi).
