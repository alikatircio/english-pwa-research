import { expect, test } from '@playwright/test';
import type { AnswerLog, Progress } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, canonical, items } from './helpers/app.ts';
import { readStore } from './helpers/db.ts';

test.describe('new-card intro (decisions 33, 34)', () => {
  test('a new card opens on the study view: chunk highlighted, note, no commonMistake; "Hazırım" hides it and opens the keyboard', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false });
    await app.startButton.click();

    const study = page.getByTestId('study-view');
    await expect(study).toBeVisible();
    await expect(app.situation).toHaveText(app.situationOf(0));
    await expect(page.getByTestId('study-sentence')).toHaveText(canonical(0));
    // Only the words under the cloze blanks are highlighted ("I'll ___ the report today." → "send").
    await expect(study.locator('mark')).toHaveText(['send']);
    await expect(study.getByText(items[0]?.noteTr ?? '')).toBeVisible();
    await expect(study.getByText(items[0]?.commonMistake ?? '')).toHaveCount(0);
    await expect(page.locator('.answer-input')).toHaveCount(0);
    await expect(app.check).toHaveCount(0);

    // Looking is not an answer: nothing is written, and a reload brings the study view back.
    expect(await readStore(page, 'progress')).toEqual([]);
    await page.reload();
    await app.resumeButton.click();
    await expect(page.getByTestId('study-view')).toBeVisible();

    await app.ready.click();
    await expect(page.getByTestId('study-view')).toHaveCount(0);
    await expect(page.getByTestId('study-sentence')).toHaveCount(0); // hidden: now produce it
    await expect(page.locator('.answer-input')).toBeFocused();
    await app.answer(canonical(0));
    await expect(page.locator('.verdict--ok')).toBeVisible();
  });

  test('the re-ask of a new card has no study view', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await app.answer(canonical(0));
    await app.next.click();
    for (const i of [1, 2, 3]) {
      await app.answer(canonical(i)); // passes each study view
      await app.next.click();
    }
    // Position 4: the re-ask of card 0.
    await expect(app.situation).toHaveText(app.situationOf(0));
    await expect(page.locator('.answer-input')).toBeVisible();
    await expect(page.getByTestId('study-view')).toHaveCount(0);
  });

  test('"Bilmiyorum" on a new card reveals the answer and records wrong (box 1), without self-grading', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await expect(app.input).toBeFocused();
    await page.getByRole('button', { name: t.dontKnow }).click();

    await expect(page.locator('.answers__canonical')).toHaveText(canonical(0));
    await expect(page.getByRole('group', { name: t.howWasIt })).toHaveCount(0);
    await expect(app.next).toBeFocused();
    expect(await readStore<Progress>(page, 'progress')).toEqual([expect.objectContaining({ itemId: items[0]?.id, box: 1, lastGrade: 'wrong', dueOn: '2026-11-03' })]);
    expect(await readStore<AnswerLog>(page, 'answerLog')).toEqual([
      expect.objectContaining({ itemId: items[0]?.id, grade: 'wrong', gradedBy: 'self', mode: 'write', answer: '', boxBefore: null, boxAfter: 1 }),
    ]);
    // New card, new pattern card: commonMistake still hidden at box 1.
    await expect(page.locator('details.pattern-card').getByText(items[0]?.commonMistake ?? '')).toHaveCount(0);
  });
});
