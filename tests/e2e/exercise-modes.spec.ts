import { expect, test, type Page } from '@playwright/test';
import { answerTokens } from '../../src/domain/exerciseMode.ts';
import type { AnswerLog, Progress, SessionState } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, canonical, items } from './helpers/app.ts';
import { readStore, writeStore } from './helpers/db.ts';

const DAY = '2026-11-02';

/** Chips still loose, in the order shown. */
async function poolWords(page: Page): Promise<string[]> {
  return page.getByTestId('order-pool').getByRole('button').allInnerTexts();
}

test.describe('exercise modes (decision 31)', () => {
  test('a new card is "Sırala": shuffled chips, tap to place, tap a placed chip to return it, exact order is auto-correct', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    await app.startButton.click();

    await expect(page.getByRole('heading', { name: t.orderHeading })).toBeVisible();
    await expect(page.locator('.answer-input')).toHaveCount(0);
    await expect(page.getByTestId('hint')).toHaveCount(0); // hints only in write mode
    await expect(app.check).toBeDisabled();

    const words = answerTokens(canonical(0));
    const shown = await poolWords(page);
    expect([...shown].sort()).toEqual([...words].sort());
    expect(shown).not.toEqual(words);

    // Chips are comfortable one-handed targets.
    for (const chip of await page.getByTestId('order-pool').getByRole('button').all()) {
      const box = await chip.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }

    // A wrong tap is undone by tapping the placed chip.
    const wrongFirst = words[words.length - 1] ?? '';
    await page.getByRole('button', { name: t.orderChipAdd(wrongFirst) }).click();
    const placed = page.getByTestId('order-placed');
    await expect(placed.getByRole('button')).toHaveCount(1);
    await page.getByRole('button', { name: t.orderChipRemove(wrongFirst, 1) }).click();
    await expect(placed.getByRole('button')).toHaveCount(0);
    expect((await poolWords(page)).length).toBe(words.length);

    for (const w of words) {
      await expect(app.check).toBeDisabled();
      await page.getByTestId('order-pool').getByRole('button', { name: t.orderChipAdd(w) }).first().click();
    }
    await expect(app.check).toBeEnabled();
    await app.check.click();

    await expect(page.locator('.verdict--ok')).toContainText(t.correct);
    await expect(page.getByRole('group', { name: t.howWasIt })).toHaveCount(0);
    const progress = await readStore<Progress>(page, 'progress');
    expect(progress).toEqual([expect.objectContaining({ itemId: items[0]?.id, box: 2, shows: 1 })]);
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ itemId: items[0]?.id, grade: 'correct', gradedBy: 'auto', mode: 'order', answer: canonical(0) })]);
  });

  test('a wrong order is not auto-graded: result, self-grade, undo stay as in write mode', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    await app.startButton.click();

    // Place the words exactly as shuffled: never the right order.
    for (const w of await poolWords(page)) {
      await page.getByTestId('order-pool').getByRole('button', { name: t.orderChipAdd(w) }).first().click();
    }
    await app.check.click();
    await expect(page.getByRole('heading', { name: t.notMatched })).toBeVisible();
    await expect(page.locator('.answers__canonical')).toHaveText(canonical(0));
    await app.grade(t.gradePartial);
    await expect(app.next).toBeVisible();
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ grade: 'partial', gradedBy: 'self', mode: 'order' })]);
    await page.getByRole('button', { name: t.undo }).click();
    await expect(page.getByRole('group', { name: t.howWasIt })).toBeVisible();
    expect(await readStore(page, 'answerLog')).toEqual([]);
  });

  test('every 3rd showing of a box 2 card is "Hatayı düzelt": mistake shown, empty textarea, accepted answer is correct', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    const itemId = items[0]?.id ?? '';
    const now = await page.evaluate(() => Date.now());
    const progress: Progress = { itemId, box: 2, dueOn: DAY, introducedOn: '2026-10-20', lastAnsweredOn: '2026-10-25', lastGrade: 'correct', updatedAt: now, shows: 2 };
    const session: SessionState = {
      key: 'current', day: DAY, startedAt: now, updatedAt: now,
      queue: [{ itemId, kind: 'due' }], cursor: 0, phase: { tag: 'question' }, draft: '',
      repeatQueued: [], consecutiveWrong: 0, studiedChunks: [],
    };
    await writeStore(page, 'progress', [progress]);
    await writeStore(page, 'session', [session]);
    await page.reload();
    await app.resumeButton.click();

    await expect(page.getByRole('heading', { name: t.fixHeading })).toBeVisible();
    await expect(page.getByTestId('fix-mistake')).toHaveText(items[0]?.commonMistake ?? '');
    await expect(page.getByTestId('hint')).toHaveCount(0);
    const field = page.getByRole('textbox', { name: t.fixHeading });
    await expect(field).toHaveValue('');
    await expect(app.check).toBeDisabled();

    await field.fill(canonical(0));
    await app.check.click();
    await expect(page.locator('.verdict--ok')).toContainText(t.correct);
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ itemId, grade: 'correct', gradedBy: 'auto', mode: 'fix', answer: canonical(0) })]);
    const after = await readStore<Progress>(page, 'progress');
    expect(after).toEqual([expect.objectContaining({ box: 3, shows: 3 })]);
  });

  test('a box 2 card on its 2nd showing is plain "Yaz" with its hint', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    const itemId = items[0]?.id ?? '';
    const now = await page.evaluate(() => Date.now());
    const progress: Progress = { itemId, box: 2, dueOn: DAY, introducedOn: '2026-10-20', lastAnsweredOn: '2026-10-25', lastGrade: 'correct', updatedAt: now, shows: 1 };
    const session: SessionState = {
      key: 'current', day: DAY, startedAt: now, updatedAt: now,
      queue: [{ itemId, kind: 'due' }], cursor: 0, phase: { tag: 'question' }, draft: '',
      repeatQueued: [], consecutiveWrong: 0, studiedChunks: [],
    };
    await writeStore(page, 'progress', [progress]);
    await writeStore(page, 'session', [session]);
    await page.reload();
    await app.resumeButton.click();
    await expect(app.input).toBeVisible();
    await expect(page.getByTestId('hint')).toBeVisible();
    await app.answer(canonical(0));
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ mode: 'write' })]);
  });
});
