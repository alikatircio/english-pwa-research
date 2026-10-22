import { expect, test, type Page } from '@playwright/test';
import type { NotebookEntry } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, items } from './helpers/app.ts';
import { answeredProgress, seedStores } from './helpers/seed.ts';

const open: NotebookEntry = {
  id: 'nb-entry-1',
  textTr: 'sorunu ekibe yükseltmek',
  contextTr: '[Teams] Mert’e yazıyorsun.',
  createdAt: 1,
  status: 'open',
};
const converted: NotebookEntry = { id: 'nb-done', textTr: 'eski not', createdAt: 2, status: 'converted', convertedItemId: 'x' };

/** Home with everything answered and the given notebook, then Settings. */
async function openSettings(page: Page, notebook: NotebookEntry[]): Promise<void> {
  const app = new App(page);
  await app.open();
  await seedStores(page, {
    put: { progress: answeredProgress(items.map((i) => i.id)), notebook },
    delete: { session: ['current'] },
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: t.todayDone })).toBeVisible();
  await page.getByRole('button', { name: t.settings }).click();
}

const copyButton = (page: Page) => page.getByRole('button', { name: t.claudeCopy });

test.describe("Claude'a yapıştır (Settings)", () => {
  test('copies the prompt with the open entries to the clipboard (Chromium)', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions can be granted in Chromium only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openSettings(page, [open, converted]);

    for (const step of t.claudeHelpSteps) await expect(page.getByText(step)).toBeVisible();
    await copyButton(page).click();
    await expect(page.getByRole('status')).toHaveText(t.claudeCopied);

    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('Return ONLY one JSON code block');
    expect(text).toContain('"format": "english-pwa-items"');
    expect(text).toContain('1. id: nb-entry-1');
    expect(text).toContain('textTr: "sorunu ekibe yükseltmek"');
    expect(text).toContain('contextTr: "[Teams] Mert’e yazıyorsun."');
    expect(text).not.toContain('eski not');
  });

  test('without a clipboard the text goes to the Web Share sheet', async ({ page }) => {
    // WebKit cannot grant clipboard access here: assert the button and the fallback only.
    await page.addInitScript(() => {
      const w = window as unknown as { sharedText?: string };
      Object.defineProperty(Navigator.prototype, 'clipboard', {
        configurable: true,
        get: () => ({ writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) }),
      });
      Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(Navigator.prototype, 'share', {
        configurable: true,
        value: (data: ShareData) => {
          w.sharedText = data.text;
          return Promise.resolve();
        },
      });
    });
    await openSettings(page, [open]);

    await expect(copyButton(page)).toBeVisible();
    await copyButton(page).click();
    await expect(page.getByRole('status')).toHaveText(t.claudeShared);
    const shared = await page.evaluate(() => (window as unknown as { sharedText?: string }).sharedText);
    expect(shared).toContain('1. id: nb-entry-1');
  });

  test('no open entries: the button is hidden', async ({ page }) => {
    await openSettings(page, [converted]);
    await expect(page.getByText(t.notebookNothingPending)).toBeVisible();
    await expect(copyButton(page)).toHaveCount(0);
    await expect(page.getByText(t.claudeHelpTitle)).toHaveCount(0);
  });
});
