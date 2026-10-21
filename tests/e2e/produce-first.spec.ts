import { expect, test } from '@playwright/test';
import type { AnswerLog, Progress } from '../../src/domain/types.ts';
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
    await expect(page.getByText(t.modelSentences)).toBeVisible();
    await expect(app.next).toBeVisible();
    await expect(page.getByRole('group', { name: t.howWasIt })).toHaveCount(0); // no self-grading

    // Written when "Kontrol et" ran, before any further tap.
    const progress = await readStore<Progress>(page, 'progress');
    expect(progress).toEqual([expect.objectContaining({ itemId: items[0]?.id, box: 2, lastGrade: 'correct', dueOn: '2026-11-04' })]);
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ itemId: items[0]?.id, grade: 'correct', gradedBy: 'auto', answer: typed })]);

    // After a reload the answered card is still answered: Sonraki leads to the second item.
    await page.reload();
    await expect(page.locator('.verdict--ok')).toContainText(t.correct);
    await app.next.click();
    await expect(app.situation).toHaveText(app.situationOf(1));
    await expect(app.input).toBeFocused();
  });

  test('an unmatched answer shows answer, canonical and checklist; Sonraki only after a self-grade', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await app.answer('I will to send the report', 'button');

    await expect(page.getByText(t.notMatched)).toBeVisible();
    await expect(page.locator('.answers__mine')).toHaveText('I will to send the report');
    await expect(page.locator('.answers__canonical')).toHaveText(canonical(0));
    for (const c of items[0]?.checklistTr ?? []) await expect(page.getByText(c)).toBeVisible();
    await expect(app.next).toHaveCount(0);
    expect(await readStore(page, 'progress')).toEqual([]);

    await app.grade(t.gradePartial);
    await expect(page.getByRole('status')).toHaveText(t.gradedAs(t.gradePartial));
    await expect(app.next).toBeVisible();
    const progress = await readStore<Progress>(page, 'progress');
    expect(progress).toEqual([expect.objectContaining({ itemId: items[0]?.id, box: 1, lastGrade: 'partial', dueOn: '2026-11-03' })]);
    const log = await readStore<AnswerLog>(page, 'answerLog');
    expect(log).toEqual([expect.objectContaining({ grade: 'partial', gradedBy: 'self', boxBefore: null, boxAfter: 1 })]);
  });

  test('answering every item ends on the "all done" screen', async ({ page }) => {
    const app = new App(page);
    await app.open();
    for (let i = 0; i < items.length; i++) {
      await expect(app.situation).toHaveText(app.situationOf(i));
      await app.answer(canonical(i));
      await app.next.click();
    }
    await expect(page.getByText(t.allDone)).toBeVisible();
    // Session writes are write-behind (only grades are awaited); wait for the clear before reloading.
    await expect.poll(() => readStore(page, 'session')).toEqual([]);
    await page.reload();
    await expect(page.getByText(t.allDone)).toBeVisible();
  });
});
