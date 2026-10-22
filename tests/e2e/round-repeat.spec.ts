import { expect, test } from '@playwright/test';
import { ROUND_SIZE } from '../../src/domain/session.ts';
import type { AnswerLog, Progress } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, canonical, items } from './helpers/app.ts';
import { at, day } from './helpers/clock.ts';
import { readStore, writeStore } from './helpers/db.ts';

/**
 * Every fixture item due today in box 1, oldest due first in file order, so the
 * round is items 0..7 (due order: dueOn ↑) and every card shows the stage 1 cloze.
 */
function allDue(): Progress[] {
  return items.map((i, n) => ({
    itemId: i.id,
    box: 1,
    dueOn: day(-20 + n),
    introducedOn: day(-30),
    lastAnsweredOn: day(-21 + n),
    lastGrade: 'wrong',
    updatedAt: 1,
  }));
}

test.describe('round with in-round re-asks (decisions 1, 38)', () => {
  test('wrong on card 2 and partial on card 5 come back 4 cards later without a hint, and change no box', async ({ page }) => {
    const app = new App(page);
    await app.open(at(0), { start: false });
    await writeStore(page, 'progress', allDue());
    await page.reload();
    await expect(app.startButton).toHaveText(t.start(items.length)); // 12 due, ≤ 40: no new cards (decision 2)
    await app.start();

    const dots = page.getByTestId('round-dots').locator('.round-dots__dot');
    const hint = page.getByTestId('hint');
    await expect(dots).toHaveCount(ROUND_SIZE);

    // Queue order after the two inserts: 0 1 2 3 4 [1] 5 6 [4] 7 (a re-ask sits at answer position + 4).
    const sequence = [0, 1, 2, 3, 4, 1, 5, 6, 4, 7];
    const reasks = new Set([5, 8]);
    for (const [pos, i] of sequence.entries()) {
      await expect(app.situation).toHaveText(app.situationOf(i));
      await expect(dots.nth(pos)).toHaveClass(/round-dots__dot--current/);
      await expect(hint).toHaveCount(0);
      if (reasks.has(pos)) {
        // A re-ask is hint-free: no "İpucu" button either (decision 38).
        await expect(page.getByRole('button', { name: t.hintButton })).toHaveCount(0);
        await expect(dots.nth(pos)).toHaveClass(/round-dots__dot--reask/);
      } else {
        await expect(page.getByRole('button', { name: t.hintButton })).toBeVisible();
      }
      if (pos === 1 || pos === 4) {
        await app.answer('Something else entirely');
        await app.grade(pos === 1 ? t.gradeWrong : t.gradePartial);
        await expect(dots).toHaveCount(ROUND_SIZE + (pos === 1 ? 1 : 2)); // each re-ask adds one dot
      } else {
        await app.answer(canonical(i));
      }
      await app.next.click();
    }

    // Round end: one line of the chunks studied, no numbers, two equal buttons.
    await expect(page.getByRole('heading', { name: t.roundDone })).toBeFocused();
    await expect(page.locator('.round-end__summary')).toHaveText(t.roundSummary(items.slice(0, ROUND_SIZE).map((i) => i.targetChunk)));
    await expect(page.locator('.round-end__summary')).not.toHaveText(/\d/);
    await expect(dots).toHaveCount(0);
    const another = page.getByRole('button', { name: t.anotherRound });
    const enough = page.getByRole('button', { name: t.enough });
    const [a, b] = [await another.boundingBox(), await enough.boundingBox()];
    expect(a && b && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1).toBe(true);

    // A re-ask writes a log row but leaves the box alone (decisions 5, 38).
    const progress = await readStore<Progress>(page, 'progress');
    const byId = new Map(progress.map((p) => [p.itemId, p]));
    expect(byId.get(items[1]?.id ?? '')).toMatchObject({ box: 1, lastGrade: 'wrong', dueOn: day(1) });
    expect(byId.get(items[4]?.id ?? '')).toMatchObject({ box: 1, lastGrade: 'partial', dueOn: day(1) });
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log.filter((l) => l.isRepeat).map((l) => [l.itemId, l.grade, l.boxBefore, l.boxAfter])).toEqual([
      [items[1]?.id, 'correct', 1, 1],
      [items[4]?.id, 'correct', 1, 1],
    ]);
    expect(await readStore(page, 'dailyCounters')).toEqual([{ day: day(0), newIntroduced: 0, reviewsAnswered: ROUND_SIZE }]);

    // "Bir tur daha": the remaining due cards, in a new round.
    await another.click();
    await expect(app.situation).toHaveText(app.situationOf(ROUND_SIZE));
    await expect(app.input).toBeFocused();
    await expect(dots).toHaveCount(items.length - ROUND_SIZE);
  });

  test('"Bu kadar" leaves without a question; Home shows what is left', async ({ page }) => {
    const app = new App(page);
    await app.open(at(0), { start: false });
    await writeStore(page, 'progress', allDue());
    await page.reload();
    await app.start();
    for (let i = 0; i < ROUND_SIZE; i++) {
      await app.answer(canonical(i));
      await app.next.click();
    }
    await page.getByRole('button', { name: t.enough }).click();
    await expect(app.todayCount).toHaveText(t.todayCount(items.length - ROUND_SIZE));
    await expect(app.startButton).toHaveText(t.start(items.length - ROUND_SIZE));
  });
});
