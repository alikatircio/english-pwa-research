import { expect, test } from '@playwright/test';

test('app shell renders the Turkish placeholder', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('./');

  await expect(page).toHaveTitle('İngilizce Üretim');
  await expect(page.getByRole('heading', { level: 1, name: 'İngilizce Üretim' })).toBeVisible();
  expect(errors).toEqual([]);
});
