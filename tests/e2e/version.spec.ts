import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { t } from '../../src/ui/strings.tr.ts';
import { App } from './helpers/app.ts';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

test('Home and Settings show which build is running', async ({ page }) => {
  const app = new App(page);
  await app.open('2026-11-02T08:00:00', { start: false });
  await expect(page.getByTestId('version-home')).toHaveText(new RegExp(`^v${version.replaceAll('.', '\\.')} · \\d{2}\\.\\d{2}\\.\\d{4}$`));

  await page.getByRole('button', { name: t.settings }).click();
  const line = page.getByTestId('version-settings');
  await expect(line).toHaveText(
    new RegExp(`^Sürüm ${version.replaceAll('.', '\\.')} · \\d{2}\\.\\d{2}\\.\\d{4} · \\S+ · içerik e2e-fixt$`),
  );
});
