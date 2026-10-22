import { expect, test } from '@playwright/test';
import type { Flag } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, fixture, items } from './helpers/app.ts';
import { readStore } from './helpers/db.ts';

test.describe('flag ⚑ (decision 12)', () => {
  test('flagging on the question screen stores the flag and the card leaves the round after a reload', async ({ page }) => {
    const app = new App(page);
    await app.open();
    const flag = page.getByRole('button', { name: t.flag });
    await expect(flag).toHaveAttribute('aria-pressed', 'false');
    const box = await flag.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await app.input.fill('I will');
    await flag.click();
    await expect(flag).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(t.flagged)).toBeVisible();
    expect(await readStore<Flag>(page, 'flags')).toEqual([
      expect.objectContaining({ itemId: items[0]?.id, screen: 'question', contentVersion: fixture.contentVersion }),
    ]);

    await app.reloadAndResume();
    await expect(app.situation).toHaveText(app.situationOf(1));
    await expect(flag).toHaveAttribute('aria-pressed', 'false');
  });

  test('pressing again removes the flag and the card stays', async ({ page }) => {
    const app = new App(page);
    await app.open();
    const flag = page.getByRole('button', { name: t.flag });
    await flag.click();
    await expect(flag).toHaveAttribute('aria-pressed', 'true');
    await flag.click();
    await expect(flag).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText(t.flagged)).toHaveCount(0);
    expect(await readStore(page, 'flags')).toEqual([]);

    await app.reloadAndResume();
    await expect(app.situation).toHaveText(app.situationOf(0));
  });

  test('the flag is on the result screen too and keeps the answer', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await app.answer('I will to send the report');
    await page.getByRole('button', { name: t.flag }).click();
    await expect(page.getByText(t.flagged)).toBeVisible();
    expect(await readStore<Flag>(page, 'flags')).toEqual([
      expect.objectContaining({ itemId: items[0]?.id, screen: 'result', userAnswer: 'I will to send the report' }),
    ]);
    // Grading a flagged card still works; Sonraki moves on.
    await app.grade(t.gradeWrong);
    await app.next.click();
    await expect(app.situation).toHaveText(app.situationOf(1));
  });
});
