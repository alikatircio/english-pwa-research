/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { t } from '../../src/ui/strings.tr.ts';
import { App, canonical } from './helpers/app.ts';

// T5.6: the production build (vite build + preview, see playwright.config.ts) works
// offline once the service worker has precached it (07 §6.1).

test('after one online visit the app reloads offline and a card can be answered', async ({ page, context }) => {
  const app = new App(page);
  await app.open('2026-11-02T08:00:00', { start: false });
  // Runs on both projects today; a WebKit build without service workers would skip rather than fail.
  test.skip(!(await page.evaluate(() => 'serviceWorker' in navigator)), 'no service worker support in this browser build');

  // Wait for the SW to finish installing (precache) and activate. It does not claim
  // open pages (clientsClaim: false), so one more online load puts the page under it.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(app.todayCount).toBeVisible();
  await app.start();
  await app.answer(canonical(0));
  await expect(page.getByRole('status')).toHaveText(t.correct);
  await expect(app.next).toBeVisible();

  // The grade is on disk too: back on Home after another offline reload the round resumes.
  await page.reload();
  await expect(app.resumeButton).toBeVisible();
  await context.setOffline(false);
});
