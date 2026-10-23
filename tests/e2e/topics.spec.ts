/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { t } from '../../src/ui/strings.tr.ts';
import { App, canonical } from './helpers/app.ts';
import { readStore } from './helpers/db.ts';

const FUTURE = 'e2e-topic-future';
const PREPOSITIONS = 'e2e-topic-prepositions';

const learningStores = async (page: Page) => ({
  progress: await readStore(page, 'progress'),
  answerLog: await readStore(page, 'answerLog'),
  dailyCounters: await readStore(page, 'dailyCounters'),
});

async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: t.settings }).click();
  await expect(page.getByRole('heading', { name: t.diagSection })).toBeVisible();
}

async function expectTopicPage(page: Page): Promise<void> {
  await expect(page.getByTestId('topic-page')).toBeVisible();
  await expect(page.getByTestId('topic-heading')).toBeFocused();
  await expect(page.getByTestId('topic-traps')).toBeVisible();
  await expect(page.getByTestId('topic-refs')).toBeVisible();
}

async function closeTopic(page: Page): Promise<void> {
  await page.getByTestId('topic-close').click();
  await expect(page.getByTestId('topic-page')).toBeHidden();
}

test.describe('Konu anlatımları', () => {
  test('Settings list opens a topic page and Geri returns to the same Settings spot', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false });
    await openSettings(page);

    const list = page.getByTestId('topic-list');
    await expect(list).toBeVisible();
    await expect(page.getByTestId(`topic-open-${PREPOSITIONS}`)).toBeVisible();
    await page.getByTestId(`topic-open-${FUTURE}`).click();
    await expectTopicPage(page);
    await expect(page.getByRole('button', { name: t.topicClose })).toBeVisible();

    await closeTopic(page);
    await expect(page.getByRole('heading', { name: t.diagSection })).toBeVisible();
    await expect(list).toBeVisible();
    await expect(page.getByTestId(`topic-open-${FUTURE}`)).toBeInViewport();
    await expect(page.getByTestId(`topic-open-${FUTURE}`)).toBeFocused();
  });

  test('Seviye testi result: a weak-area topic opens and closing keeps the result screen', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false });
    await openSettings(page);
    await page.getByRole('button', { name: t.diagStart }).click();

    const total = 48;
    const unsure = page.getByRole('button', { name: t.diagUnsure, exact: true });
    for (let n = 1; n <= total; n++) {
      await expect(page.getByTestId('diag-progress')).toHaveText(t.diagProgress(n, total));
      await unsure.click();
      await expect(unsure).toHaveAttribute('aria-pressed', 'true');
      if (n < total) await page.getByRole('button', { name: t.diagNext, exact: true }).click();
    }
    await page.getByRole('button', { name: t.diagFinish, exact: true }).click();
    await expect(page.getByTestId('diag-result-table')).toBeVisible();

    const links = page.getByTestId('topic-links-future');
    await expect(links).toBeVisible();
    await links.getByTestId(`topic-open-${FUTURE}`).click();
    await expectTopicPage(page);

    await closeTopic(page);
    await expect(page.getByRole('heading', { name: t.diagResultTitle })).toBeVisible();
    await expect(page.getByTestId('diag-result-table')).toBeVisible();
    await expect(links).toBeVisible();
  });

  test('round: topic from a card result returns to the same result, writes nothing, round continues', async ({ page }) => {
    const app = new App(page);
    await app.open();
    const typed = canonical(0);
    await app.answer(typed);
    await expect(page.getByRole('status')).toHaveText(t.correct);
    await expect(app.next).toBeVisible();
    const resultText = await page.getByRole('status').innerText();
    // The grade/log writes are async: wait until the answer is on disk before taking the baseline.
    await expect.poll(async () => (await readStore(page, 'answerLog')).length).toBeGreaterThan(0);
    const before = await learningStores(page);

    await page.getByTestId('topic-link').click();
    await expectTopicPage(page);
    expect(await learningStores(page)).toEqual(before);

    await closeTopic(page);
    await expect(page.getByRole('status')).toHaveText(resultText);
    await expect(app.next).toBeVisible();
    await expect(page.getByTestId('topic-link')).toBeVisible();
    await expect(page.getByText(typed).first()).toBeVisible();
    expect(await learningStores(page)).toEqual(before);

    // Proceeding works: the next card shows its question.
    await app.next.click();
    await app.passStudy();
    await expect(page.locator('.answer-input')).toBeFocused();
  });

  test('offline: a topic page opens from the service worker precache', async ({ page, context }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false });
    test.skip(!(await page.evaluate(() => 'serviceWorker' in navigator)), 'no service worker support in this browser build');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(app.todayCount).toBeVisible();
    await openSettings(page);
    await page.getByTestId(`topic-open-${FUTURE}`).click();
    await expectTopicPage(page);
    await closeTopic(page);
    await expect(page.getByTestId('topic-list')).toBeVisible();
    await context.setOffline(false);
  });
});
