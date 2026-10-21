import { expect, test } from '@playwright/test';
import type { SessionState } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, canonical } from './helpers/app.ts';
import { readStore } from './helpers/db.ts';

async function storedDraft(app: App): Promise<string | undefined> {
  return (await readStore<SessionState>(app.page, 'session'))[0]?.draft;
}

test.describe('resume after reload', () => {
  test('mid-card draft survives a reload on the same card', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await app.answer(canonical(0));
    await app.next.click();

    await app.input.fill('Could you che');
    await page.clock.runFor(400); // past the ~300 ms draft debounce
    await expect.poll(() => storedDraft(app)).toBe('Could you che');

    await page.reload();
    await expect(app.situation).toHaveText(app.situationOf(1));
    await expect(app.input).toHaveValue('Could you che');
  });

  test('a result screen survives a reload as the result screen', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await app.answer('Totally different');
    await expect(page.getByText(t.notMatched)).toBeVisible();
    await expect.poll(async () => (await readStore<SessionState>(page, 'session'))[0]?.phase.tag).toBe('result');

    await page.reload();
    await expect(page.getByText(t.notMatched)).toBeVisible();
    await expect(page.locator('.answers__mine')).toHaveText('Totally different');
    await expect(page.getByRole('group', { name: t.howWasIt })).toBeVisible();
  });

  test('a session older than 12 hours is dropped silently', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00');
    await app.input.fill('half written');
    await page.clock.runFor(400);
    await expect.poll(() => storedDraft(app)).toBe('half written');

    await page.clock.setSystemTime(new Date('2026-11-02T20:30:00'));
    await page.reload();
    await expect(app.situation).toHaveText(app.situationOf(0));
    await expect(app.input).toHaveValue('');
  });
});
