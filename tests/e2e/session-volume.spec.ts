import { expect, test } from '@playwright/test';
import { DAILY_NEW_CAP } from '../../src/domain/session.ts';
import type { MetaRecord } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App } from './helpers/app.ts';
import { readStore } from './helpers/db.ts';

test.describe('daily new-card cap (decision 29)', () => {
  test('default is 10; changing it in Settings changes Home and survives a reload', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, cap: null });
    await expect(app.todayCount).toHaveText(t.todayCount(DAILY_NEW_CAP));

    await page.getByRole('button', { name: t.settings }).click();
    const group = page.getByRole('radiogroup', { name: t.capLabel });
    await expect(group.getByRole('radio', { name: '10' })).toHaveAttribute('aria-checked', 'true');
    await group.getByRole('radio', { name: '5', exact: true }).click();
    await expect(group.getByRole('radio', { name: '5', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(async () => (await readStore<MetaRecord>(page, 'meta')).find((m) => m.key === 'dailyNewCap')?.value).toBe(5);

    await page.getByRole('button', { name: t.back, exact: true }).click();
    await expect(app.todayCount).toHaveText(t.todayCount(5));
    await page.reload();
    await expect(app.todayCount).toHaveText(t.todayCount(5));
  });
});
