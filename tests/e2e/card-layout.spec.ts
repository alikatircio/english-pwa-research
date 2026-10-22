/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { t } from '../../src/ui/strings.tr.ts';
import { App } from './helpers/app.ts';

test('answer textarea has the iOS keyboard attributes and a ≥16px font', async ({ page }) => {
  await new App(page).open();
  const input = page.getByRole('textbox', { name: t.questionHeading });
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute('autocorrect', 'off');
  await expect(input).toHaveAttribute('autocapitalize', 'sentences');
  await expect(input).toHaveAttribute('autocomplete', 'off');
  await expect(input).toHaveAttribute('spellcheck', 'false');
  await expect(input).toHaveAttribute('enterkeyhint', 'go');
  await expect(input).toHaveAttribute('lang', 'en');
  // Named by the visible Turkish heading, described by the situation (a11y audit 08 #6, #7).
  await expect(input).toHaveAccessibleDescription(/\S/);
  const fontSize = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(16);
});

for (const screen of ['home', 'card'] as const) {
  test(`${screen}: primary button is full width, ≥44px tall, at the bottom, and nothing is position: fixed`, async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: screen === 'card' });
    const button = screen === 'card' ? page.getByRole('button', { name: t.check }) : app.startButton;
    const box = await button.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport).toBeTruthy();
    if (!box || !viewport) return;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThan(viewport.width - 40);
    expect(box.y + box.height).toBeGreaterThan(viewport.height - 80);
    const fixed = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).position === 'fixed').length);
    expect(fixed).toBe(0);
  });
}
