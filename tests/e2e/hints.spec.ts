import { expect, test, type Page } from '@playwright/test';
import type { AnswerLog, Box, Progress, SessionState } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, canonical, items } from './helpers/app.ts';
import { readStore, writeStore } from './helpers/db.ts';

const DAY = '2026-11-02';

/** Seed item 0 as a due card in the given box (two cards in the round) and resume it. */
async function seedDue(page: Page, box: Box): Promise<void> {
  const itemId = items[0]?.id ?? '';
  const now = await page.evaluate(() => Date.now());
  const progress: Progress = { itemId, box, dueOn: DAY, introducedOn: '2026-10-20', lastAnsweredOn: '2026-10-25', lastGrade: 'correct', updatedAt: now, shows: 1 };
  const session: SessionState = {
    key: 'current', day: DAY, startedAt: now, updatedAt: now,
    queue: [{ itemId, kind: 'due' }, { itemId: items[1]?.id ?? '', kind: 'new' }], cursor: 0, phase: { tag: 'question' }, draft: '',
    repeatQueued: [], consecutiveWrong: 0, studiedChunks: [],
  };
  await writeStore(page, 'progress', [progress]);
  await writeStore(page, 'session', [session]);
  await page.reload();
  await page.getByRole('button', { name: t.resume }).click();
}

test.describe('hints on demand (decision 35)', () => {
  test('no hint line at first, whatever the box; "İpucu": 1st tap the cloze, 2nd tap also the initials of the chunk', async ({ page }) => {
    const app = new App(page);
    await app.open();
    for (const box of [1, 2, 4] as const) {
      await seedDue(page, box);
      await expect(app.situation).toHaveText(app.situationOf(0));
      await expect(page.getByTestId('hint')).toHaveCount(0);
    }
    const button = page.getByRole('button', { name: t.hintButton });
    const hint = page.getByTestId('hint');

    await button.click();
    await expect(hint).toHaveAttribute('data-stage', '1');
    await expect(page.getByTestId('hint-cloze')).toHaveText(items[0]?.clozeTemplate ?? '');
    await expect(page.getByTestId('hint-initials')).toHaveCount(0);
    await expect(app.input).toBeFocused(); // the keyboard stays up

    await button.click();
    await expect(hint).toHaveAttribute('data-stage', '2');
    // "I'll ___ the report today." + "I'll send the report today." → "s…"
    await expect(page.getByTestId('hint-initials')).toHaveText('s…');
    await expect(page.getByTestId('hint-cloze')).toHaveText(items[0]?.clozeTemplate ?? '');
    await expect(button).toHaveCount(0); // nothing more to give
  });

  test('the opened hint survives a reload and is gone on the next card and on the result screen', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await seedDue(page, 3);
    await page.getByRole('button', { name: t.hintButton }).click();
    await expect.poll(async () => (await readStore<SessionState>(page, 'session'))[0]?.hint).toBe(1);
    await app.reloadAndResume();
    await expect(page.getByTestId('hint')).toHaveAttribute('data-stage', '1');

    await app.answer('Something else');
    await expect(page.getByTestId('hint')).toHaveCount(0);
    await app.grade(t.gradeWrong);
    await app.next.click();
    await app.passStudy();
    await expect(page.getByTestId('hint')).toHaveCount(0);
    await expect(page.getByRole('button', { name: t.hintButton })).toBeVisible();
  });

  test('a correct answer with a hint counts as partial: box stays, due tomorrow, UI says so, log records hintUsed', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await seedDue(page, 3);
    await page.getByRole('button', { name: t.hintButton }).click();
    await page.getByRole('button', { name: t.hintButton }).click();
    await app.answer(canonical(0));

    await expect(page.locator('.verdict--ok')).toContainText(t.correct);
    await expect(page.getByTestId('hint-credit')).toHaveText(t.correctWithHint);
    await expect(app.next).toBeVisible();
    const progress = await readStore<Progress>(page, 'progress');
    expect(progress.find((p) => p.itemId === items[0]?.id)).toMatchObject({ box: 3, lastGrade: 'partial', dueOn: '2026-11-03' });
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ itemId: items[0]?.id, grade: 'partial', gradedBy: 'auto', hintUsed: 2, boxBefore: 3, boxAfter: 3 })]);
  });

  test('without a hint a correct answer still moves the box and says nothing about hints', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await seedDue(page, 3);
    await app.answer(canonical(0));
    await expect(page.getByTestId('hint-credit')).toHaveCount(0);
    expect((await readStore<Progress>(page, 'progress')).find((p) => p.itemId === items[0]?.id)).toMatchObject({ box: 4, lastGrade: 'correct' });
    expect(await readStore<AnswerLog>(page, 'answerLog')).toEqual([expect.objectContaining({ grade: 'correct', hintUsed: 0 })]);
  });

  test('self-graded "Doğru" after a hint is stored as partial, with the note', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await seedDue(page, 2);
    await page.getByRole('button', { name: t.hintButton }).click();
    await app.answer('Could you check');
    await app.grade(t.gradeCorrect);
    await expect(page.getByTestId('hint-credit')).toHaveText(t.correctWithHint);
    await expect(page.locator('.graded:not(.hint-credit)')).toHaveText(t.gradedAs(t.gradePartial));
    expect((await readStore<Progress>(page, 'progress')).find((p) => p.itemId === items[0]?.id)).toMatchObject({ box: 2, lastGrade: 'partial' });
  });

  test('no hint button on the study view, in "Sırala", or on a re-ask', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false });
    await app.startButton.click();
    await expect(page.getByTestId('study-view')).toBeVisible();
    await expect(page.getByRole('button', { name: t.hintButton })).toHaveCount(0);
  });
});
