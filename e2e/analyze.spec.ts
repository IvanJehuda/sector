import { expect, test } from '@playwright/test';

test('pasted text produces a retrospective report with evidence and disclaimer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#laporan')).toHaveCount(0);
  await page
    .getByLabel('Tautan atau isi berita')
    .fill(
      'Presiden menyampaikan pidato tentang rencana pengelolaan BUMN melalui badan investasi baru. Pelaku pasar menanggapi rencana tersebut dengan hati-hati, terutama pada saham bank milik negara.',
    );
  await page.getByLabel('Tanggal berita (opsional)').fill('2026-03-02');
  await page.getByRole('button', { name: 'Cek dampak berita' }).click();

  await expect(page).toHaveURL(/\/events\//, { timeout: 30_000 });
  await expect(page.getByText('bukan saran investasi').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Retrospektif')).toBeVisible();
  await expect(page.getByText('PT Bank Rakyat Indonesia (Persero) Tbk').first()).toBeVisible();

  // The finished report now stays on the homepage, once, in its own section.
  const title = 'Presiden menyampaikan pidato tentang rencana pengelolaan BUMN melalui badan investasi baru.';
  await page.goto('/');
  await expect(page.locator('#laporan').getByText(title)).toBeVisible();
  await expect(page.locator('#berita').getByText(title)).toHaveCount(0);
});

test('automatic receiver adds news to the feed', async ({ page, request }) => {
  const res = await request.get('/api/cron/poll', { headers: { Authorization: 'Bearer e2e-secret' } });
  expect(res.ok()).toBe(true);
  await page.goto('/');
  await expect(page.locator('#berita').getByText('(Contoh) Pemerintah kaji restrukturisasi bank BUMN')).toBeVisible();
});

test('cron endpoint rejects requests without the secret', async ({ request }) => {
  expect((await request.get('/api/cron/poll')).status()).toBe(401);
  expect((await request.get('/api/cron/analyze')).status()).toBe(401);
});

test('automatic analysis leaves news without a closing price alone', async ({ request }) => {
  // The fake feed is dated today, so nothing has a closed session to measure yet.
  const res = await request.get('/api/cron/analyze', { headers: { Authorization: 'Bearer e2e-secret' } });
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ skipped: 'no-candidate' });
});
