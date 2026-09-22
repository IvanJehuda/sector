import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:3100' },
  webServer: {
    command:
      'node -e "require(\'fs\').rmSync(\'e2e.db\',{force:true})" && npx -y pnpm@9 dev --port 3100',
    url: 'http://localhost:3100',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      SECTORS_MODE: 'fake',
      LLM_MODE: 'fake',
      FAKE_SHOCK_DAY: '2026-03-02',
      DATABASE_URL: 'file:e2e.db',
      CRON_SECRET: 'e2e-secret',
    },
  },
});
