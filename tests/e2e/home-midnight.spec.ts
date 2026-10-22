import { expect, test } from '@playwright/test';
import { t } from '../../src/ui/strings.tr.ts';
import { App, items } from './helpers/app.ts';
import { answeredProgress, seedStores } from './helpers/seed.ts';

test.describe('Home over midnight (review 09 #7)', () => {
  test('"Bugün bitti" left open in the foreground shows the new day after midnight', async ({ page }) => {
    const app = new App(page);
    // Everything answered on 11-02 and due on 11-04; it is 23:59 on 11-03.
    await app.open('2026-11-03T23:59:00', { start: false });
    await seedStores(page, { put: { progress: answeredProgress(items.map((i) => i.id)) }, delete: { session: ['current'] } });
    await page.reload();
    await expect(page.getByRole('heading', { name: t.todayDone })).toBeVisible();
    await expect(app.startButton).toHaveCount(0);

    // No reload, no visibilitychange: only time passes.
    await page.clock.runFor(2 * 60_000);
    await expect(page.getByRole('heading', { name: t.todayDone })).toHaveCount(0);
    await expect(app.startButton).toBeVisible();
    await app.start();
  });
});
