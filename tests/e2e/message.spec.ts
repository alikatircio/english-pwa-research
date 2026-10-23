import { expect, test, type Page } from '@playwright/test';
import type { AnswerLog, Box, Progress } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, items } from './helpers/app.ts';
import { readStore } from './helpers/db.ts';
import { answeredProgress, seedStores } from './helpers/seed.ts';

const BLANK_ITEMS = ['e2e-get-back', 'e2e-look-into', 'e2e-wait-for'];

/** Day done, every item answered; the message's blank items get the given boxes. */
async function openDoneDay(page: Page, app: App, boxes: Record<string, Box>): Promise<Progress[]> {
  await app.open('2026-11-02T08:00:00', { start: false });
  const seeded = answeredProgress(items.map((i) => i.id)).map((p) => (p.itemId in boxes ? { ...p, box: boxes[p.itemId]! } : p));
  await seedStores(page, { put: { progress: seeded }, delete: { session: ['current'] } });
  await page.reload();
  await expect(page.getByRole('heading', { name: t.todayDone })).toBeVisible();
  await page.getByRole('button', { name: t.practice }).click();
  await expect(page.locator('.answer-input')).toBeFocused();
  return seeded;
}

/** Answer practice cards until the message step or the round end shows up. */
async function playCards(page: Page, app: App): Promise<void> {
  const step = page.getByTestId('message-step');
  const end = page.getByRole('heading', { name: t.roundDone });
  for (let i = 0; i < 20; i++) {
    if ((await step.isVisible()) || (await end.isVisible())) return;
    await app.answer('something else entirely');
    await app.grade(t.gradeWrong);
    await app.next.click();
    await step.or(end).or(page.locator('.answer-input')).or(app.ready).first().waitFor();
  }
}

test.describe('message step (decisions 49, 59)', () => {
  test('free practice ends with the message; it logs per blank and never touches Leitner', async ({ page }) => {
    const app = new App(page);
    const seeded = await openDoneDay(page, app, Object.fromEntries(BLANK_ITEMS.map((id) => [id, 4])));
    await playCards(page, app);

    const step = page.getByTestId('message-step');
    await expect(step).toBeVisible();
    await expect(page.getByTestId('message-channel')).toHaveText(t.messageChannel.teams);
    await expect(page.getByTestId('message-context')).not.toBeEmpty();

    const blanks = page.locator('.context-blank');
    await expect(blanks).toHaveCount(3);
    await blanks.nth(0).fill('back'); // right
    await blanks.nth(1).fill('wrongword'); // wrong, expected "into"
    await blanks.nth(2).fill('waiting'); // right
    await page.getByRole('button', { name: t.check }).click();

    const results = page.getByTestId('context-blank-result');
    await expect(results).toHaveCount(3);
    await expect(results.nth(0)).toHaveAttribute('data-correct', 'true');
    await expect(results.nth(1)).toHaveAttribute('data-correct', 'false');
    await expect(results.nth(2)).toHaveAttribute('data-correct', 'true');
    await expect(results.nth(1).locator('.context-blank__expected')).toHaveText('into');

    await page.getByRole('button', { name: t.messageDone }).click();
    await expect(page.getByRole('heading', { name: t.roundDone })).toBeVisible();

    // Progress and counters as seeded (practice rows may add lastPracticedAt only).
    const core = (p: Progress) => ({ itemId: p.itemId, box: p.box, dueOn: p.dueOn, lastAnsweredOn: p.lastAnsweredOn, lastGrade: p.lastGrade });
    const after = await readStore<Progress>(page, 'progress');
    expect(after.map(core)).toEqual(expect.arrayContaining(seeded.map(core)));
    expect(after).toHaveLength(seeded.length);
    expect(await readStore(page, 'dailyCounters')).toEqual([]);

    const rows = (await readStore<AnswerLog>(page, 'answerLog')).filter((l) => l.mode === 'message');
    expect(rows).toHaveLength(3);
    expect(rows.every((l) => l.messageId === 'msg-e2e-status')).toBe(true);
    expect(rows.map((l) => l.itemId).sort()).toEqual([...BLANK_ITEMS].sort());
  });

  test('a blank item below box 4: the practice round has no message step', async ({ page }) => {
    const app = new App(page);
    await openDoneDay(page, app, { 'e2e-get-back': 4, 'e2e-look-into': 3, 'e2e-wait-for': 4 });
    await playCards(page, app);
    await expect(page.getByRole('heading', { name: t.roundDone })).toBeVisible();
    await expect(page.getByTestId('message-step')).toHaveCount(0);
    expect((await readStore<AnswerLog>(page, 'answerLog')).filter((l) => l.mode === 'message')).toHaveLength(0);
  });
});
