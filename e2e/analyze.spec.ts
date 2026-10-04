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
  // The footer already carries the disclaimer, so wait on the report itself.
  await expect(page.getByText('Retrospektif')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('PT Bank Rakyat Indonesia (Persero) Tbk').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/kuota/i);

  // The AI's guess sits beside what the market actually did, per sub-sector.
  const impact = page.locator('#dampak');
  await expect(impact.getByText('Banks', { exact: true })).toBeVisible();
  await expect(impact.getByText('TEKANAN', { exact: true })).toBeVisible();
  await expect(impact.getByText('(Contoh) Ketidakpastian kebijakan.')).toBeVisible();
  await expect(impact.getByText('Kenyataan', { exact: true })).toBeVisible();
  // Columns must really form: Tailwind drops class names that are assembled from fragments.
  const header = impact.locator('[data-impact-header]');
  const columns = await header.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(4);
  // The AI's reason must stay readable on a laptop and a small tablet, not collapse beside fixed-width columns.
  for (const width of [1280, 800]) {
    await page.setViewportSize({ width, height: 900 });
    const reasonTrack = await header.evaluate((el) => parseFloat(getComputedStyle(el).gridTemplateColumns.split(' ')[1]));
    expect(reasonTrack, `reason column at ${width}px`).toBeGreaterThanOrEqual(200);
    const overflow = await impact.locator('[data-impact-header] ~ div').first().evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, `row overflow at ${width}px`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  // The finished report now stays on the homepage, once, in its own section.
  const title = 'Presiden menyampaikan pidato tentang rencana pengelolaan BUMN melalui badan investasi baru.';
  await page.goto('/');
  await expect(page.locator('#laporan').getByText(title)).toBeVisible();
  await expect(page.locator('#berita').getByText(title)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/kuota/i);
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
  expect((await request.get('/api/credits')).status()).toBe(401);
});

test('credit usage stays readable for the team with the secret', async ({ request }) => {
  const res = await request.get('/api/credits', { headers: { Authorization: 'Bearer e2e-secret' } });
  expect(res.ok()).toBe(true);
  expect(Object.keys(await res.json()).sort()).toEqual(['budget', 'state', 'used']);
});

test('automatic analysis leaves news without a closing price alone', async ({ request }) => {
  // The fake feed is dated today, so nothing has a closed session to measure yet.
  const res = await request.get('/api/cron/analyze', { headers: { Authorization: 'Bearer e2e-secret' } });
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ skipped: 'no-candidate' });
});

test('a hypothesis report leads with the impact table and shows no measured reaction', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('Tautan atau isi berita')
    .fill(
      'Pemerintah berencana mengubah aturan dividen bank milik negara mulai tahun depan. Pelaku pasar menunggu rincian kebijakan tersebut sebelum menilai dampaknya.',
    );
  // A future date keeps this deterministic: the fake IHSG series covers every weekday up to today,
  // so an undated article tested on a weekday before 16:00 WIB would turn out retrospective.
  await page.getByLabel('Tanggal berita (opsional)').fill('2099-01-05');
  await page.getByRole('button', { name: 'Cek dampak berita' }).click();

  await expect(page).toHaveURL(/\/events\//, { timeout: 30_000 });
  const impact = page.locator('#dampak');
  await expect(impact).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/HIPOTESIS/).first()).toBeVisible();
  await expect(impact.getByText('TEKANAN', { exact: true })).toBeVisible();
  await expect(impact.getByText('Kenyataan', { exact: true })).toHaveCount(0);

  const tableTop = (await impact.boundingBox())!.y;
  const stocksTop = (await page.getByRole('heading', { name: 'Saham yang terkait dengan berita ini' }).boundingBox())!.y;
  expect(tableTop).toBeLessThan(stocksTop);
});
