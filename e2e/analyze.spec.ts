import { expect, test } from '@playwright/test';

test('pasted text produces a retrospective report with evidence and disclaimer', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('Atau tempel teks berita')
    .fill(
      'Presiden menyampaikan pidato tentang rencana pengelolaan BUMN melalui badan investasi baru. Pelaku pasar menanggapi rencana tersebut dengan hati-hati, terutama pada saham bank milik negara.',
    );
  await page.getByLabel('Tanggal event (opsional)').fill('2026-03-02');
  await page.getByRole('button', { name: 'Analisis berita' }).click();

  await expect(page).toHaveURL(/\/events\//, { timeout: 30_000 });
  await expect(page.getByText('bukan saran investasi')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Retrospektif')).toBeVisible();
  await expect(page.getByText('BBRI · PT Bank Rakyat Indonesia (Persero) Tbk')).toBeVisible();
});

test('automatic receiver adds news to the feed', async ({ page, request }) => {
  const res = await request.get('/api/cron/poll', { headers: { Authorization: 'Bearer e2e-secret' } });
  expect(res.ok()).toBe(true);
  await page.goto('/');
  await expect(page.getByText('(Contoh) Pemerintah kaji restrukturisasi bank BUMN')).toBeVisible();
});

test('cron endpoint rejects requests without the secret', async ({ request }) => {
  expect((await request.get('/api/cron/poll')).status()).toBe(401);
});
