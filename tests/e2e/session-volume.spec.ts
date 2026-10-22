import { expect, test } from '@playwright/test';
import { DAILY_NEW_CAP } from '../../src/domain/session.ts';
import type { AnswerLog, MetaRecord, Progress } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, items } from './helpers/app.ts';
import { readStore } from './helpers/db.ts';
import { answeredProgress, seedStores } from './helpers/seed.ts';

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

test.describe('free practice (decision 30)', () => {
  test('after the day is done: an 8-card round that changes neither boxes nor counters, resumes, and offers itself again', async ({ page }) => {
    const app = new App(page);
    const practice = page.getByRole('button', { name: t.practice });
    await app.open('2026-11-02T08:00:00', { start: false });
    const seeded = answeredProgress(items.map((i) => i.id));
    await seedStores(page, { put: { progress: seeded }, delete: { session: ['current'] } });
    await page.reload();
    await expect(page.getByRole('heading', { name: t.todayDone })).toBeVisible();

    await practice.click();
    await expect(page.locator('.answer-input')).toBeFocused();
    await app.answer('something else entirely');
    await app.grade(t.gradeCorrect);
    await expect.poll(async () => (await readStore(page, 'answerLog')).length).toBe(1); // written before the reload

    // Resume: reload mid-round, "Devam et" brings the same practice round back.
    await app.reloadAndResume();
    await expect(app.next).toBeVisible(); // the graded card's result screen, as left
    await app.next.click();
    for (let i = 1; i < 8; i++) {
      await app.answer('something else entirely');
      await app.grade(t.gradeWrong);
      await app.next.click();
    }

    // Round end: nothing left today, practice is offered again next to "Bu kadar".
    await expect(page.getByRole('heading', { name: t.roundDone })).toBeVisible();
    await expect(practice).toBeVisible();
    await page.getByRole('button', { name: t.enough }).click();
    await expect(page.getByRole('heading', { name: t.todayDone })).toBeVisible();

    expect(await readStore<Progress>(page, 'progress')).toEqual(expect.arrayContaining(seeded));
    expect(await readStore<Progress>(page, 'progress')).toHaveLength(seeded.length);
    expect(await readStore(page, 'dailyCounters')).toEqual([]);
    const logs = await readStore<AnswerLog>(page, 'answerLog');
    expect(logs).toHaveLength(8);
    expect(logs.every((l) => l.mode === 'practice' && !l.isRepeat)).toBe(true);
  });

  test('not offered while cards are left today', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false });
    await expect(app.startButton).toBeVisible();
    await expect(page.getByRole('button', { name: t.practice })).toHaveCount(0);
  });
});

test.describe('notebook help (decision 32)', () => {
  test('empty notebook: one hint line on Home; the sheet shows the 3 steps until dismissed, for good', async ({ page }) => {
    const app = new App(page);
    const help = page.getByTestId('notebook-help');
    await app.open('2026-11-02T08:00:00', { start: false });
    await expect(page.getByTestId('notebook-hint')).toHaveText(t.notebookEmptyHint);

    await page.getByRole('button', { name: t.notebookAdd }).click();
    await expect(help).toBeVisible();
    await expect(help.getByRole('listitem')).toHaveText([...t.notebookHelpSteps]);
    await help.getByRole('button', { name: t.dismiss }).click();
    await expect(help).toHaveCount(0);
    await page.getByRole('button', { name: t.notebookCancel }).click();

    await page.reload();
    await page.getByRole('button', { name: t.notebookAdd }).click();
    await expect(page.getByRole('textbox', { name: t.notebookLabel })).toBeVisible();
    await expect(help).toHaveCount(0); // stays closed after a reload

    await page.getByRole('textbox', { name: t.notebookLabel }).fill('sorunu ekibe yükseltmek');
    await page.getByRole('button', { name: t.notebookSave }).click();
    await expect(page.getByTestId('notebook-hint')).toHaveCount(0); // the notebook is not empty any more
  });
});
