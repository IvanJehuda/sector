import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  // Next.js's Tailwind v4 postcss.config.mjs uses a string-based plugin list that
  // Vite's eager postcss loader (unrelated to our node-environment tests) can't
  // parse. Disable postcss resolution for the test runner to avoid that crash.
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: { SECTORS_MODE: 'fixture', LLM_MODE: 'fake' },
  },
});
