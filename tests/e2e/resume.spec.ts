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
    await app.passStudy();

    await app.input.fill('Could you che');
    await page.clock.runFor(400); // past the ~300 ms draft debounce
    await expect.poll(() => storedDraft(app)).toBe('Could you che');

    await app.reloadAndResume();
    await expect(app.situation).toHaveText(app.situationOf(1));
    await expect(app.input).toHaveValue('Could you che');
    await expect(app.input).toBeFocused();
  });

  test('a result screen survives a reload as the result screen', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await app.answer('Totally different');
    await expect(page.getByRole('heading', { name: t.notMatched })).toBeVisible();
    await expect.poll(async () => (await readStore<SessionState>(page, 'session'))[0]?.phase.tag).toBe('result');

    await app.reloadAndResume();
    await expect(page.getByRole('heading', { name: t.notMatched })).toBeVisible();
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
    await expect(app.resumeButton).toHaveCount(0);
    await app.start();
    await expect(app.situation).toHaveText(app.situationOf(0));
    await expect(app.input).toHaveValue('');
  });

  test('a round left open on the card screen is dropped when the app comes back days later (09 #5)', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T22:00:00');
    await app.input.fill('half written');
    await page.clock.runFor(400);
    await expect.poll(() => storedDraft(app)).toBe('half written');

    // The phone was locked on the card; iOS kept the page in memory until Wednesday morning.
    await page.clock.setSystemTime(new Date('2026-11-04T08:00:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(app.startButton).toBeVisible();
    await expect(app.resumeButton).toHaveCount(0);
    await expect.poll(() => readStore(page, 'session')).toEqual([]);
    await app.start();
    await expect(app.input).toHaveValue('');
  });

  test('"← Ana ekran" mid-card keeps the draft; "Devam et" returns to the same card', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await app.input.fill('Could you che');
    const back = page.getByRole('button', { name: t.backHomeLabel });
    expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect((await back.boundingBox())?.width).toBeGreaterThanOrEqual(44);
    await back.click(); // inside the 300 ms debounce: the tap flushes the draft
    await expect(app.resumeButton).toBeVisible();
    await expect.poll(() => storedDraft(app)).toBe('Could you che');

    await app.resumeButton.click();
    await expect(app.situation).toHaveText(app.situationOf(0));
    await expect(app.input).toHaveValue('Could you che');
  });

  test('"← Ana ekran" from the result phase resumes on the same result', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await app.answer('Totally different');
    await expect(page.getByRole('heading', { name: t.notMatched })).toBeVisible();
    await page.getByRole('button', { name: t.backHomeLabel }).click();
    await expect(app.resumeButton).toBeVisible();

    await app.resumeButton.click();
    await expect(page.getByRole('heading', { name: t.notMatched })).toBeVisible();
    await expect(page.locator('.answers__mine')).toHaveText('Totally different');
    await expect(page.getByRole('group', { name: t.howWasIt })).toBeVisible();
  });
});
