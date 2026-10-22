import { expect, test } from '@playwright/test';
import { DAILY_NEW_CAP } from '../../src/domain/session.ts';
import type { Progress } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, canonical, items } from './helpers/app.ts';
import { at, day, reopenOnDay, setDay } from './helpers/clock.ts';
import { readStore } from './helpers/db.ts';

const id = (i: number): string => items[i]?.id ?? '';

test.describe('Leitner across days (decisions 2–4)', () => {
  test('5 new on day 1; wrong/partial due the next day at stage 1; correct due two days later at stage 2', async ({ page }) => {
    const app = new App(page);
    const hint = page.getByTestId('hint');

    // Day 1: five new cards, then "Bugün bitti" although 7 items are still unseen (decision 3).
    await app.open(at(0), { start: false });
    await expect(app.startButton).toHaveText(t.start(DAILY_NEW_CAP));
    await app.start();
    for (let i = 0; i < DAILY_NEW_CAP; i++) {
      await expect(app.situation).toHaveText(app.situationOf(i));
      await expect(hint).toHaveAttribute('data-stage', '1'); // new card = stage 1
      if (i === 1 || i === 2) {
        await app.answer('Something else entirely');
        await app.grade(i === 1 ? t.gradeWrong : t.gradePartial);
      } else {
        await app.answer(canonical(i));
      }
      await app.next.click();
    }
    for (const i of [1, 2]) {
      await expect(app.situation).toHaveText(app.situationOf(i)); // end-of-round repeats
      await app.answer(canonical(i));
      await app.next.click();
    }
    await expect(page.getByRole('button', { name: t.anotherRound })).toHaveCount(0);
    await page.getByRole('button', { name: t.enough }).click();
    await expect(page.getByRole('heading', { name: t.todayDone })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: t.todayDone })).toBeVisible();

    // Day 2: the wrong and partial cards are due (box 1, +1 day), first, at stage 1; then 5 new again.
    await reopenOnDay(page, 1);
    await expect(app.startButton).toHaveText(t.start(2 + DAILY_NEW_CAP));
    await app.start();
    for (const i of [1, 2]) {
      await expect(app.situation).toHaveText(app.situationOf(i));
      await expect(hint).toHaveAttribute('data-stage', '1');
      await app.answer(canonical(i));
      await app.next.click();
    }
    await expect(app.situation).toHaveText(app.situationOf(DAILY_NEW_CAP)); // first new card of day 2
    await expect(app.todayCount).toHaveCount(0); // still in the round

    // Day 3: the day-1 correct cards (box 2, +2 days) are due with the stage 2 initials;
    // yesterday's open round is stale, so Home offers "Başla", not "Devam et".
    await reopenOnDay(page, 2);
    await expect(app.resumeButton).toHaveCount(0);
    await expect(app.startButton).toHaveText(t.start(3 + DAILY_NEW_CAP));
    await app.start();
    // Due order: dueOn, box, then id → e2e-depend-on (item 4) first.
    await expect(app.situation).toHaveText(app.situationOf(4));
    await expect(hint).toHaveAttribute('data-stage', '2');

    const progress = new Map((await readStore<Progress>(page, 'progress')).map((p) => [p.itemId, p]));
    for (const i of [0, 3, 4]) expect(progress.get(id(i))).toMatchObject({ box: 2, dueOn: day(2), introducedOn: day(0) });
    for (const i of [1, 2]) expect(progress.get(id(i))).toMatchObject({ box: 2, dueOn: day(3), lastAnsweredOn: day(1) });
  });

  test('midnight: a round keeps its day for the counter, Leitner uses the answer day (03 §4.5)', async ({ page }) => {
    const app = new App(page);
    await app.open(at(0, '23:58:00'));
    await app.answer(canonical(0));
    await setDay(page, 1, '00:02:00'); // the round goes on past midnight
    await app.next.click();
    await expect(app.situation).toHaveText(app.situationOf(1));
    await app.answer(canonical(1));
    await expect(page.locator('.verdict--ok')).toBeVisible();

    const progress = new Map((await readStore<Progress>(page, 'progress')).map((p) => [p.itemId, p]));
    expect(progress.get(id(0))).toMatchObject({ introducedOn: day(0), dueOn: day(2) });
    expect(progress.get(id(1))).toMatchObject({ introducedOn: day(1), dueOn: day(3) });
    // Both first answers count toward the day the round was built: the 5 cap is not used twice.
    expect(await readStore(page, 'dailyCounters')).toEqual([{ day: day(0), newIntroduced: 2, reviewsAnswered: 0 }]);
  });
});
