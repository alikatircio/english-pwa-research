import { expect, test } from '@playwright/test';
import type { AnswerLog, Progress } from '../../src/domain/types.ts';
import { DAILY_NEW_CAP } from '../../src/domain/session.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, canonical, items, smart } from './helpers/app.ts';
import { readStore } from './helpers/db.ts';

test.describe('produce-first card', () => {
  test('empty answer cannot be checked; an exact match (smart apostrophe, Enter) is auto-correct and saved at once', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await expect(app.situation).toHaveText(app.situationOf(0));
    await expect(app.check).toBeDisabled();
    await app.input.fill('   ');
    await expect(app.check).toBeDisabled();

    const typed = smart(canonical(0)).replace(/\.$/, ''); // "I’ll send the report today"
    expect(typed).toContain('’');
    await app.answer(typed, 'enter');

    await expect(page.locator('.verdict--ok')).toContainText(t.correct);
    // Focus moves to the verdict heading and the short verdict is announced (a11y audit 08 #1, #2).
    await expect(page.getByRole('heading', { name: t.correct })).toBeFocused();
    await expect(page.getByRole('status')).toHaveText(t.correct);
    await expect(page.getByText(t.modelSentences)).toBeVisible();
    await expect(app.next).toBeVisible();
    await expect(page.getByRole('group', { name: t.howWasIt })).toHaveCount(0); // no self-grading

    // Written when "Kontrol et" ran, before any further tap.
    const progress = await readStore<Progress>(page, 'progress');
    expect(progress).toEqual([expect.objectContaining({ itemId: items[0]?.id, box: 2, lastGrade: 'correct', dueOn: '2026-11-04' })]);
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ itemId: items[0]?.id, grade: 'correct', gradedBy: 'auto', answer: typed })]);

    // After a reload Home counts one card less; "Devam et" reopens the answered card, Sonraki leads to the second item.
    await page.reload();
    await expect(app.todayCount).toHaveText(t.todayCount(DAILY_NEW_CAP - 1));
    await app.resumeButton.click();
    await expect(page.locator('.verdict--ok')).toContainText(t.correct);
    await app.next.click();
    await expect(app.situation).toHaveText(app.situationOf(1));
    await expect(app.input).toBeFocused();
  });

  test('an unmatched answer shows answer, canonical and checklist; Sonraki only after a self-grade', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await app.answer('I will to send the report', 'button');

    const verdict = page.getByRole('heading', { name: t.notMatched });
    await expect(verdict).toBeVisible();
    await expect(verdict).toBeFocused();
    await expect(page.locator('.result [role="status"]')).toHaveCount(0);
    await expect(page.locator('.card-screen > .screen__body > [role="status"]')).toHaveText(t.notMatched);
    await expect(page.locator('.answers__mine')).toHaveText('I will to send the report');
    await expect(page.locator('.answers__canonical')).toHaveText(canonical(0));
    for (const c of items[0]?.checklistTr ?? []) await expect(page.getByText(c)).toBeVisible();
    await expect(app.next).toHaveCount(0);
    expect(await readStore(page, 'progress')).toEqual([]);

    await app.grade(t.gradePartial);
    await expect(page.locator('.graded')).toHaveText(t.gradedAs(t.gradePartial));
    await expect(app.next).toBeVisible();
    await expect(app.next).toBeFocused(); // 08 #3
    const progress = await readStore<Progress>(page, 'progress');
    expect(progress).toEqual([expect.objectContaining({ itemId: items[0]?.id, box: 1, lastGrade: 'partial', dueOn: '2026-11-03' })]);
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ grade: 'partial', gradedBy: 'self', boxBefore: null, boxAfter: 1 })]);
  });

  test('the first day offers 5 new cards (decision 3); then round end and Home say "Bugün bitti"', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false });
    await expect(app.todayCount).toHaveText(t.todayCount(DAILY_NEW_CAP));
    await expect(app.startButton).toHaveText(t.start(DAILY_NEW_CAP));
    await app.start();
    for (let i = 0; i < DAILY_NEW_CAP; i++) {
      await expect(app.situation).toHaveText(app.situationOf(i));
      await app.answer(canonical(i));
      await app.next.click();
    }
    await expect(page.getByRole('heading', { name: t.roundDone })).toBeFocused(); // 08 #8
    // Nothing left today: no "Bir tur daha", only "Bu kadar".
    await expect(page.getByRole('button', { name: t.anotherRound })).toHaveCount(0);
    await page.getByRole('button', { name: t.enough }).click();
    await expect(page.getByRole('heading', { name: t.todayDone })).toBeFocused();
    await expect(page.getByText(t.todayDoneDetail)).toBeVisible();
    await expect(app.startButton).toHaveCount(0); // no bottom button on a finished day
    await expect(app.resumeButton).toHaveCount(0);
    // Session writes are write-behind (only grades are awaited); wait for the clear before reloading.
    await expect.poll(() => readStore(page, 'session')).toEqual([]);
    await page.reload();
    await expect(page.getByRole('heading', { name: t.todayDone })).toBeVisible();
  });

  test('pattern card: closed after a match, open after an unmatched answer (decision 11)', async ({ page }) => {
    const app = new App(page);
    await app.open();
    const card = page.locator('details.pattern-card');

    await app.answer(canonical(0));
    await expect(card).toBeVisible();
    await expect(card).not.toHaveAttribute('open');
    await expect(card.locator('summary')).toContainText(items[0]?.targetChunk ?? '');
    await expect(card.getByText(items[0]?.noteTr ?? '')).toBeHidden();
    await card.locator('summary').click();
    await expect(card.getByText(items[0]?.noteTr ?? '')).toBeVisible();

    await app.next.click();
    await app.answer('Could you to check the build');
    await expect(card).toHaveAttribute('open', '');
    const item = items[1];
    await expect(card.locator('summary')).toContainText(item?.targetChunk ?? '');
    for (const s of item?.modelSentences ?? []) await expect(card.getByText(s, { exact: true })).toBeVisible();
    await expect(card.getByText(item?.commonMistake ?? '')).toBeVisible();
    await expect(card.getByText(item?.noteTr ?? '')).toBeVisible();
    // Stays open after self-grading.
    await app.grade(t.gradeWrong);
    await expect(card).toHaveAttribute('open', '');
  });

  test('Geri al within 4 s restores the ungraded result and the stored data (decision 10)', async ({ page }) => {
    const app = new App(page);
    await app.open();
    const undo = page.getByRole('button', { name: t.undo });
    await app.answer('I will to send the report');
    await app.grade(t.gradePartial);
    await expect(undo).toBeVisible();
    expect(await readStore(page, 'answerLog')).toHaveLength(1);

    await undo.click();
    await expect(page.getByRole('group', { name: t.howWasIt })).toBeVisible();
    await expect(page.getByRole('heading', { name: t.notMatched })).toBeFocused();
    await expect(app.next).toHaveCount(0);
    await expect(page.locator('.answers__mine')).toHaveText('I will to send the report');
    expect(await readStore(page, 'progress')).toEqual([]);
    expect(await readStore(page, 'answerLog')).toEqual([]);
    expect(await readStore(page, 'dailyCounters')).toEqual([expect.objectContaining({ newIntroduced: 0, reviewsAnswered: 0 })]);

    // Grade again; after 4 s the undo is gone and the grade stays.
    await app.grade(t.gradeWrong);
    await expect(undo).toBeVisible();
    await page.clock.runFor(4100);
    await expect(undo).toHaveCount(0);
    await expect(app.next).toBeVisible();
    const progress = await readStore<Progress>(page, 'progress');
    expect(progress).toEqual([expect.objectContaining({ itemId: items[0]?.id, lastGrade: 'wrong' })]);
  });

  test('an auto match offers no undo', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await app.answer(canonical(0));
    await expect(app.next).toBeVisible();
    await expect(page.getByRole('button', { name: t.undo })).toHaveCount(0);
  });
});
