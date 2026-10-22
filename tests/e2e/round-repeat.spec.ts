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

test.describe('round with end-of-round repeats (decisions 1, 5)', () => {
  test('wrong on card 2 and partial on card 5 come back after card 8, then round end and another round', async ({ page }) => {
    const app = new App(page);
    await app.open(at(0), { start: false });
    await writeStore(page, 'progress', allDue());
    await page.reload();
    await expect(app.startButton).toHaveText(t.start(items.length)); // 12 due, ≤ 25: no new cards (decision 2)
    await app.start();

    const dots = page.getByTestId('round-dots').locator('.round-dots__dot');
    const hint = page.getByTestId('hint');
    await expect(dots).toHaveCount(ROUND_SIZE);

    for (let i = 0; i < ROUND_SIZE; i++) {
      await expect(app.situation).toHaveText(app.situationOf(i));
      await expect(dots.nth(i)).toHaveClass(/round-dots__dot--current/);
      if (i === 1 || i === 4) {
        await app.answer('Something else entirely');
        await app.grade(i === 1 ? t.gradeWrong : t.gradePartial);
      } else {
        await app.answer(canonical(i));
      }
      await app.next.click();
    }

    // The two cards come back in order, with the stage 1 hint; each repeat adds one dot.
    await expect(dots).toHaveCount(ROUND_SIZE + 2);
    for (const i of [1, 4]) {
      await expect(app.situation).toHaveText(app.situationOf(i));
      await expect(hint).toHaveAttribute('data-stage', '1');
      await app.answer(canonical(i));
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

    // A repeat writes a log row but leaves the box alone (decision 5).
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
