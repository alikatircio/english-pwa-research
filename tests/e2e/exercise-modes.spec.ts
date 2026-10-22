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

  test('every 3rd showing of a box 3 card is "Hatayı düzelt": mistake shown, empty textarea, accepted answer is correct, noteTr shown after', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    const itemId = items[0]?.id ?? '';
    await resumeRound(page, app, {
      queue: [{ index: 0, kind: 'due' }, { index: 1, kind: 'due' }],
      progress: [{ index: 0, box: 3, shows: 2 }],
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
    expect(after.find((p) => p.itemId === itemId)).toMatchObject({ box: 4, shows: 3 });
  });

  test('the last card of a round is never "Hatayı düzelt", even on its 3rd showing', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    await resumeRound(page, app, {
      queue: [{ index: 1, kind: 'due' }, { index: 0, kind: 'due' }],
      cursor: 1,
      progress: [{ index: 0, box: 3, shows: 2 }, { index: 1, box: 1, shows: 1 }],
    });
    await expect(app.input).toBeVisible();
    await expect(page.getByTestId('fix-mistake')).toHaveCount(0);
  });

  test('a box 2 card is plain "Yaz", even on its 3rd showing', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false, mode: 'auto' });
    await resumeRound(page, app, {
      queue: [{ index: 0, kind: 'due' }, { index: 1, kind: 'due' }],
      progress: [{ index: 0, box: 2, shows: 2 }],
    });
    await expect(app.input).toBeVisible();
    await expect(page.getByTestId('fix-mistake')).toHaveCount(0);
    await app.answer(canonical(0));
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ mode: 'write' })]);
  });
});
