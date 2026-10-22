import { expect, test, type Page } from '@playwright/test';
import type { Box, Progress, SessionState } from '../../src/domain/types.ts';
import { App, items } from './helpers/app.ts';
import { writeStore } from './helpers/db.ts';

const DAY = '2026-11-02';

/** Seed item 0 as a due card in the given box and resume a session on it. */
async function seedDue(page: Page, box: Box): Promise<void> {
  const itemId = items[0]?.id ?? '';
  const now = await page.evaluate(() => Date.now());
  const progress: Progress = { itemId, box, dueOn: DAY, introducedOn: '2026-10-20', lastAnsweredOn: '2026-10-25', lastGrade: 'correct', updatedAt: now };
  const session: SessionState = {
    key: 'current', day: DAY, startedAt: now, updatedAt: now,
    queue: [{ itemId, kind: 'due' }], cursor: 0, phase: { tag: 'question' }, draft: '',
    repeatQueued: [], consecutiveWrong: 0, studiedChunks: [],
  };
  await writeStore(page, 'progress', [progress]);
  await writeStore(page, 'session', [session]);
  await page.reload();
}

test.describe('hint stages (decision 4)', () => {
  test('a new card shows the cloze (stage 1)', async ({ page }) => {
    const app = new App(page);
    await app.open();
    const hint = page.getByTestId('hint');
    await expect(hint).toHaveAttribute('data-stage', '1');
    await expect(hint).toContainText(items[0]?.clozeTemplate ?? '');
  });

  test('a box 2 card shows the initials of the blanked words (stage 2)', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await seedDue(page, 2);
    await expect(app.input).toBeVisible();
    const hint = page.getByTestId('hint');
    await expect(hint).toHaveAttribute('data-stage', '2');
    // "I'll ___ the report today." + "I'll send the report today." → "s…"
    await expect(hint.locator('.hint__text')).toHaveText('s…');
  });

  test('a box 3+ card shows no hint, only the situation (stage 3)', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await seedDue(page, 4);
    await expect(app.situation).toHaveText(app.situationOf(0));
    await expect(app.input).toBeVisible();
    await expect(page.getByTestId('hint')).toHaveCount(0);
  });

  test('the hint is not shown on the result screen', async ({ page }) => {
    const app = new App(page);
    await app.open();
    await app.answer('Something else');
    await expect(page.getByTestId('hint')).toHaveCount(0);
  });
});
