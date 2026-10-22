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

interface Seed {
  queue: { index: number; kind: 'due' | 'new' | 'practice' }[];
  cursor?: number;
  /** Progress per item index. */
  progress: { index: number; box: Progress['box']; shows: number }[];
}

/** Writes progress + an open round and resumes it. */
async function resumeRound(page: Page, app: App, seed: Seed): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  const progress: Progress[] = seed.progress.map((p) => ({
    itemId: items[p.index]?.id ?? '', box: p.box, dueOn: DAY, introducedOn: '2026-10-20', lastAnsweredOn: '2026-10-25', lastGrade: 'correct', updatedAt: now, shows: p.shows,
  }));
  const session: SessionState = {
    key: 'current', day: DAY, startedAt: now, updatedAt: now,
    queue: seed.queue.map((q) => ({ itemId: items[q.index]?.id ?? '', kind: q.kind })),
    cursor: seed.cursor ?? 0, phase: { tag: 'question' }, draft: '',
    repeatQueued: [], consecutiveWrong: 0, studiedChunks: [],
  };
  await writeStore(page, 'progress', progress);
  await writeStore(page, 'session', [session]);
  await page.reload();
  await app.resumeButton.click();
}

/** Free practice rotates write, fix, order by position (decisions 36, 37): cursor 2 is "Sırala". */
const practiceOrder: Seed = {
  queue: [0, 1, 2].map((index) => ({ index, kind: 'practice' as const })),
  cursor: 2,
  progress: [0, 1, 2].map((index) => ({ index, box: 2 as const, shows: 2 })),
};

test.describe('exercise modes (decisions 31, 36, 37)', () => {
  test('in free practice a card can be "Sırala": shuffled chips, tap to place, tap a placed chip to return it, exact order is auto-correct', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    await resumeRound(page, app, practiceOrder);

    await expect(page.getByRole('heading', { name: t.orderHeading })).toBeVisible();
    await expect(page.locator('.answer-input')).toHaveCount(0);
    await expect(page.getByTestId('hint')).toHaveCount(0); // hints only in write mode
    await expect(app.check).toBeDisabled();

    const words = answerTokens(canonical(2));
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
    // Practice never changes the box (decision 36).
    const progress = await readStore<Progress>(page, 'progress');
    expect(progress.find((p) => p.itemId === items[2]?.id)).toMatchObject({ box: 2, shows: 2 });
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ itemId: items[2]?.id, grade: 'correct', gradedBy: 'auto', mode: 'practice', answer: canonical(2) })]);
  });

  test('a wrong order is not auto-graded: result, self-grade, undo stay as in write mode', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    await resumeRound(page, app, practiceOrder);

    // Place the words exactly as shuffled: never the right order.
    for (const w of await poolWords(page)) {
      await page.getByTestId('order-pool').getByRole('button', { name: t.orderChipAdd(w) }).first().click();
    }
    await app.check.click();
    await expect(page.getByRole('heading', { name: t.notMatched })).toBeVisible();
    await expect(page.locator('.answers__canonical')).toHaveText(canonical(2));
    await app.grade(t.gradePartial);
    await expect(app.next).toBeVisible();
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ grade: 'partial', gradedBy: 'self', mode: 'practice' })]);
    await page.getByRole('button', { name: t.undo }).click();
    await expect(page.getByRole('group', { name: t.howWasIt })).toBeVisible();
    expect(await readStore(page, 'answerLog')).toEqual([]);
  });

  test('every 4th showing of a box 3 card is "Hatayı düzelt": mistake shown, empty textarea, accepted answer is correct, noteTr shown after', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    const itemId = items[0]?.id ?? '';
    await resumeRound(page, app, {
      queue: [{ index: 0, kind: 'due' }, { index: 1, kind: 'due' }],
      progress: [{ index: 0, box: 3, shows: 3 }],
    });

    await expect(page.getByRole('heading', { name: t.fixHeading })).toBeVisible();
    await expect(page.getByTestId('fix-mistake')).toHaveText(items[0]?.commonMistake ?? '');
    await expect(page.getByTestId('hint')).toHaveCount(0);
    const field = page.getByRole('textbox', { name: t.fixHeading });
    await expect(field).toHaveValue('');
    await expect(app.check).toBeDisabled();

    await field.fill(canonical(0));
    await app.check.click();
    await expect(page.locator('.verdict--ok')).toContainText(t.correct);
    await expect(page.getByTestId('fix-note')).toHaveText(items[0]?.noteTr ?? '');
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ itemId, grade: 'correct', gradedBy: 'auto', mode: 'fix', answer: canonical(0) })]);
    const after = await readStore<Progress>(page, 'progress');
    expect(after.find((p) => p.itemId === itemId)).toMatchObject({ box: 4, shows: 4 });
  });

  test('the last card of a round is never "Hatayı düzelt", even on its 4th showing', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    await resumeRound(page, app, {
      queue: [{ index: 1, kind: 'due' }, { index: 0, kind: 'due' }],
      cursor: 1,
      progress: [{ index: 0, box: 3, shows: 3 }, { index: 1, box: 1, shows: 1 }],
    });
    await expect(app.input).toBeVisible();
    await expect(page.getByTestId('fix-mistake')).toHaveCount(0);
  });

  test('a box 2 card is plain "Yaz", even on its 4th showing', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    await resumeRound(page, app, {
      queue: [{ index: 0, kind: 'due' }, { index: 1, kind: 'due' }],
      progress: [{ index: 0, box: 2, shows: 3 }],
    });
    await expect(app.input).toBeVisible();
    await expect(page.getByTestId('fix-mistake')).toHaveCount(0);
    await app.answer(canonical(0));
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ mode: 'write' })]);
  });

  test('"Bilmiyorum" in fix mode shows the answer and records wrong; the box falls to 1 (decision 34)', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    const itemId = items[0]?.id ?? '';
    await resumeRound(page, app, {
      queue: [{ index: 0, kind: 'due' }, { index: 1, kind: 'due' }],
      progress: [{ index: 0, box: 3, shows: 3 }],
    });
    await expect(page.getByRole('heading', { name: t.fixHeading })).toBeVisible();
    await page.getByRole('button', { name: t.dontKnow }).click();

    await expect(page.locator('.answers__canonical')).toHaveText(canonical(0));
    await expect(page.locator('.answers__mine')).toHaveText(t.noAnswer);
    await expect(page.getByRole('group', { name: t.howWasIt })).toHaveCount(0); // already graded
    await expect(page.locator('.graded')).toHaveText(t.gradedAs(t.gradeWrong));
    await expect(app.next).toBeFocused();
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ itemId, grade: 'wrong', gradedBy: 'self', mode: 'fix', answer: '', boxBefore: 3, boxAfter: 1 })]);
    expect((await readStore<Progress>(page, 'progress')).find((p) => p.itemId === itemId)).toMatchObject({ box: 1, lastGrade: 'wrong' });
  });

  test('"Bilmiyorum" is not offered in "Sırala" (practice)', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    await resumeRound(page, app, practiceOrder);
    await expect(page.getByRole('heading', { name: t.orderHeading })).toBeVisible();
    await expect(page.getByRole('button', { name: t.dontKnow })).toHaveCount(0);
  });

  test('fill in the blanks (decision 42): a box 2 card on its 2nd showing shows the blanked sentence; each blank is checked, Enter moves on', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    const itemId = items[6]?.id ?? '';
    await resumeRound(page, app, {
      queue: [{ index: 6, kind: 'due' }, { index: 1, kind: 'due' }],
      progress: [{ index: 6, box: 2, shows: 1 }],
    });

    await expect(page.getByRole('heading', { name: t.contextHeading })).toBeVisible();
    await expect(page.locator('.answer-input')).toHaveCount(0);
    await expect(page.getByTestId('hint')).toHaveCount(0);
    await expect(page.getByRole('button', { name: t.hintButton })).toHaveCount(0); // never a hint
    await expect(page.getByTestId('context-blanks')).toContainText("We're waiting");
    const blanks = page.locator('.context-blank');
    await expect(blanks).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const box = await blanks.nth(i).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(blanks.nth(i)).toHaveAttribute('autocorrect', 'off');
      await expect(blanks.nth(i)).toHaveAttribute('spellcheck', 'false');
      await expect(blanks.nth(i)).toHaveAttribute('autocapitalize', 'off');
      expect(await blanks.nth(i).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    }
    await expect(app.check).toBeDisabled();

    // Enter moves from the first blank to the second, and submits from the last (all filled).
    await blanks.nth(0).fill('for');
    await blanks.nth(0).press('Enter');
    await expect(blanks.nth(1)).toBeFocused();
    await blanks.nth(1).fill('Deploy');
    await expect(app.check).toBeEnabled();
    await blanks.nth(1).press('Enter');

    await expect(page.locator('.verdict--ok')).toContainText(t.correct);
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ itemId, grade: 'correct', gradedBy: 'auto', mode: 'context', hintUsed: 0, answer: "We're waiting for the Deploy." })]);
    expect((await readStore<Progress>(page, 'progress')).find((p) => p.itemId === itemId)).toMatchObject({ box: 3, shows: 2 });
  });

  test('fill in the blanks: a wrong blank goes to self-grade and shows the full original sentence', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    await resumeRound(page, app, {
      queue: [{ index: 6, kind: 'due' }, { index: 1, kind: 'due' }],
      progress: [{ index: 6, box: 2, shows: 1 }],
    });
    const blanks = page.locator('.context-blank');
    await blanks.nth(0).fill('to');
    await blanks.nth(0).press('Enter');
    await blanks.nth(1).fill('deploy');
    await app.check.click();

    await expect(page.getByRole('heading', { name: t.notMatched })).toBeVisible();
    await expect(page.locator('.answers__canonical')).toHaveText("We're waiting for the deploy.");
    await expect(page.locator('.answers__mine')).toHaveText("We're waiting to the deploy.");
    await app.grade(t.gradePartial);
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ grade: 'partial', gradedBy: 'self', mode: 'context' })]);
  });

  test('daily-life context (decision 44b): an item with only dailyContext gets a context card; the full sentence and a "Günlük hayat" label show after answering', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    const idx = items.findIndex((i) => i.dailyContext);
    const item = items[idx];
    if (!item?.dailyContext) throw new Error('fixture has no dailyContext item');
    await resumeRound(page, app, {
      queue: [{ index: idx, kind: 'due' }, { index: 1, kind: 'due' }],
      progress: [{ index: idx, box: 2, shows: 1 }],
    });

    await expect(page.getByRole('heading', { name: t.contextHeading })).toBeVisible();
    await expect(page.getByTestId('context-blanks')).toContainText('the sound from my old');
    const blanks = page.locator('.context-blank');
    await expect(blanks).toHaveCount(2);
    await blanks.nth(0).fill('reproduce');
    await blanks.nth(0).press('Enter');
    await blanks.nth(1).fill('rádio');
    await app.check.click();

    // A miss shows the full daily sentence as the correct answer, with the label.
    await expect(page.getByRole('heading', { name: t.notMatched })).toBeVisible();
    await expect(page.locator('.answers__canonical')).toHaveText(item.dailyContext.sentence);
    await expect(page.getByTestId('daily-label')).toHaveText(t.dailyContext);
    await app.grade(t.gradePartial);
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ itemId: item.id, grade: 'partial', gradedBy: 'self', mode: 'context' })]);
  });

  test('daily-life context: a correct answer is auto-graded and still shows the label', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    const idx = items.findIndex((i) => i.dailyContext);
    await resumeRound(page, app, {
      queue: [{ index: idx, kind: 'due' }, { index: 1, kind: 'due' }],
      progress: [{ index: idx, box: 2, shows: 1 }],
    });
    const blanks = page.locator('.context-blank');
    await blanks.nth(0).fill('reproduce');
    await blanks.nth(0).press('Enter');
    await blanks.nth(1).fill('radio');
    await blanks.nth(1).press('Enter');
    await expect(page.locator('.verdict--ok')).toContainText(t.correct);
    await expect(page.getByTestId('daily-label')).toHaveText(t.dailyContext);
    await expect(page.locator('.answers__mine')).toHaveText(items[idx]?.dailyContext?.sentence ?? '');
  });

  test('commonMistake: hidden after a wrong answer at box 2, shown at box 3 and above (decision 33)', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false });
    const mistake = page.locator('details.pattern-card').getByText(items[0]?.commonMistake ?? '');
    await resumeRound(page, app, {
      queue: [{ index: 0, kind: 'due' }, { index: 1, kind: 'due' }, { index: 2, kind: 'due' }],
      progress: [{ index: 0, box: 2, shows: 1 }, { index: 1, box: 3, shows: 1 }],
    });
    await app.answer('Something else entirely');
    await expect(page.locator('details.pattern-card')).toHaveAttribute('open', '');
    await expect(mistake).toHaveCount(0);
    await app.grade(t.gradeWrong);
    await expect(mistake).toHaveCount(0); // grading moved the card to box 1, still hidden
    await app.next.click();

    await app.answer('Something else entirely');
    await expect(page.locator('details.pattern-card').getByText(items[1]?.commonMistake ?? '')).toBeVisible();
  });
});
