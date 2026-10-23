import { expect, test, type Page } from '@playwright/test';
import type { DiagnosticAttempt } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, items } from './helpers/app.ts';
import { readStore } from './helpers/db.ts';
import { answeredProgress, seedStores } from './helpers/seed.ts';

const TOTAL = 48;

const progress = (page: Page) => page.getByTestId('diag-progress');
const unsureBtn = (page: Page) => page.getByRole('button', { name: t.diagUnsure, exact: true });
const next = (page: Page) => page.getByRole('button', { name: t.diagNext, exact: true });
const prev = (page: Page) => page.getByRole('button', { name: t.diagPrev, exact: true });
const finish = (page: Page) => page.getByRole('button', { name: t.diagFinish, exact: true });
const toSettingsFromTest = (page: Page) => page.getByRole('button', { name: t.diagBackToSettings });
const optionNames = (page: Page) => page.getByRole('checkbox').evaluateAll((els) => els.map((e) => e.closest('label')?.textContent ?? ''));

async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: t.settings }).click();
  await expect(page.getByRole('heading', { name: t.diagSection })).toBeVisible();
}

test.describe('Seviye testi (decision 47)', () => {
  test('start, leave, reload, resume with the same order, finish; result + history; learning stores untouched', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false });
    // Non-empty learning stores so "unchanged" means something.
    await seedStores(page, { put: { progress: answeredProgress(items.slice(0, 2).map((i) => i.id)) } });
    await page.reload();
    await expect(app.todayCount).toBeVisible();
    const before = {
      progress: await readStore(page, 'progress'),
      answerLog: await readStore(page, 'answerLog'),
      dailyCounters: await readStore(page, 'dailyCounters'),
    };
    expect(before.progress.length).toBeGreaterThan(0);

    // Start; Q1 unsure, Q2 one pick, Q3 unsure; land on unanswered Q4.
    await openSettings(page);
    await page.getByRole('button', { name: t.diagStart }).click();
    await expect(progress(page)).toHaveText(t.diagProgress(1, TOTAL));
    await expect(finish(page)).toBeDisabled();
    await expect(prev(page)).toBeDisabled();
    await unsureBtn(page).click();
    await expect(unsureBtn(page)).toHaveAttribute('aria-pressed', 'true');
    await next(page).click();
    await expect(progress(page)).toHaveText(t.diagProgress(2, TOTAL));
    const q2Options = await optionNames(page);
    const pick = page.getByRole('checkbox').first();
    const pickName = q2Options[0] ?? '';
    await pick.click(); // controlled input: state arrives after the write, so no check()
    await expect(pick).toBeChecked();
    await next(page).click();
    await unsureBtn(page).click();
    await next(page).click();
    await expect(progress(page)).toHaveText(t.diagProgress(4, TOTAL));
    const q4Options = await optionNames(page);
    expect(q4Options.length).toBeGreaterThan(1);

    // Leave midway: Settings offers "devam et"; the attempt is persisted.
    await toSettingsFromTest(page).click();
    await expect(page.getByRole('button', { name: t.diagContinue })).toBeVisible();
    await expect.poll(async () => (await readStore<DiagnosticAttempt>(page, 'diagnosticAttempts')).length).toBe(1);

    // Come back (same session): same question, same option order.
    await page.getByRole('button', { name: t.diagContinue }).click();
    await expect(progress(page)).toHaveText(t.diagProgress(4, TOTAL));
    expect(await optionNames(page)).toEqual(q4Options);

    // Reload lands on Home; reopen via Settings; still the same spot and order.
    await page.reload();
    await expect(app.todayCount).toBeVisible();
    await openSettings(page);
    await page.getByRole('button', { name: t.diagContinue }).click();
    await expect(progress(page)).toHaveText(t.diagProgress(4, TOTAL));
    expect(await optionNames(page)).toEqual(q4Options);

    // Earlier answers survived the reload, and Q2 has the same option order.
    await prev(page).click();
    await expect(progress(page)).toHaveText(t.diagProgress(3, TOTAL));
    await expect(unsureBtn(page)).toHaveAttribute('aria-pressed', 'true');
    await prev(page).click();
    await expect(progress(page)).toHaveText(t.diagProgress(2, TOTAL));
    expect(await optionNames(page)).toEqual(q2Options);
    await expect(page.getByRole('checkbox', { name: pickName.trim(), exact: true })).toBeChecked();
    await next(page).click();
    await next(page).click();

    // Answer the rest as "unsure"; Bitir stays disabled until the last one.
    for (let n = 4; n <= TOTAL; n++) {
      await expect(progress(page)).toHaveText(t.diagProgress(n, TOTAL));
      await unsureBtn(page).click();
      await expect(unsureBtn(page)).toHaveAttribute('aria-pressed', 'true');
      if (n < TOTAL) {
        await expect(finish(page)).toBeDisabled();
        await next(page).click();
      }
    }
    await expect(finish(page)).toBeEnabled();
    await finish(page).click();

    // Result.
    await expect(page.getByRole('heading', { name: t.diagResultTitle })).toBeVisible();
    await expect(page.getByTestId('diag-result-table')).toBeVisible();
    await expect(page.getByTestId('diag-weak')).toBeVisible();
    await expect(page.getByTestId('diag-answers')).toBeVisible();

    // Back to Settings: no open attempt any more, last result + history reachable.
    await page.getByRole('button', { name: t.diagBackToSettings }).click();
    await expect(page.getByRole('button', { name: t.diagStart })).toBeVisible();
    await page.getByRole('button', { name: t.diagShowResult }).click();
    await expect(page.getByTestId('diag-result-table')).toBeVisible();
    await page.getByRole('button', { name: t.diagBackToSettings }).click();
    await page.getByRole('button', { name: t.diagHistory, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.diagHistoryTitle })).toBeVisible();
    await expect(page.getByTestId('diag-history-table')).toBeVisible();
    await expect(page.getByTestId('diag-retake')).toBeVisible();

    // One finished attempt; the learning stores are exactly as before.
    const attempts = await readStore<DiagnosticAttempt>(page, 'diagnosticAttempts');
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.finishedAt).toBeDefined();
    expect(await readStore(page, 'progress')).toEqual(before.progress);
    expect(await readStore(page, 'answerLog')).toEqual(before.answerLog);
    expect(await readStore(page, 'dailyCounters')).toEqual(before.dailyCounters);
  });
});
