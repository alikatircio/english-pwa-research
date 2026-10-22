import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { FlagsReportV1, NotebookExportV1 } from '../../src/domain/backup.ts';
import type { Flag, Item, NotebookEntry } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, items } from './helpers/app.ts';
import { readStore } from './helpers/db.ts';
import { answeredProgress, disableWebShare, seedStores } from './helpers/seed.ts';

function sheet(page: Page) {
  return {
    open: page.getByRole('button', { name: t.notebookFromCard }),
    field: page.getByRole('textbox', { name: t.notebookLabel }),
    save: page.getByRole('button', { name: t.notebookSave }),
    cancel: page.getByRole('button', { name: t.notebookCancel }),
  };
}

test.describe('notebook capture', () => {
  test('mid-card capture keeps the card and the typed draft; context is added', async ({ page, context }) => {
    const app = new App(page);
    const nb = sheet(page);
    await app.open();
    await app.input.fill('I will sen');

    await nb.open.click();
    await expect(nb.field).toBeFocused();
    await expect(nb.save).toBeDisabled();
    await expect(page.getByText(items[0]?.situationTr ?? '')).toBeVisible(); // context = card situation
    await nb.field.fill('   ');
    await expect(nb.save).toBeDisabled();

    await context.setOffline(true); // IndexedDB only: works without a network
    await nb.field.fill('sorunu ekibe yükseltmek');
    await nb.save.click();

    await expect(nb.field).toHaveCount(0);
    await expect(page.locator('.notice')).toHaveText(t.notebookSaved);
    await expect(app.situation).toHaveText(app.situationOf(0));
    await expect(app.input).toHaveValue('I will sen');

    const stored = await readStore<NotebookEntry>(page, 'notebook');
    expect(stored).toEqual([
      expect.objectContaining({
        textTr: 'sorunu ekibe yükseltmek',
        contextTr: items[0]?.situationTr,
        contextItemId: items[0]?.id,
        status: 'open',
      }),
    ]);

    await context.setOffline(false); // offline reload needs the SW (offline.spec, Slice 5)
    await app.reloadAndResume();
    await expect(app.input).toHaveValue('I will sen');
  });

  test('the same text again warns but is saved', async ({ page }) => {
    const app = new App(page);
    const nb = sheet(page);
    await app.open();

    await nb.open.click();
    await nb.field.fill('sorunu ekibe yükseltmek');
    await nb.field.press('Enter');
    await expect(page.locator('.notice')).toHaveText(t.notebookSaved);

    await nb.open.click();
    await nb.field.fill('Sorunu ekibe YÜKSELTMEK.');
    await nb.save.click();
    await expect(page.locator('.notice')).toHaveText(`${t.notebookSaved} ${t.notebookDuplicate}`);
    await expect.poll(async () => (await readStore(page, 'notebook')).length).toBe(2);

    await page.clock.runFor(4500);
    await expect(page.locator('.notice')).toHaveCount(0);
  });

  test('"Vazgeç" closes without saving and returns to the same card', async ({ page }) => {
    const app = new App(page);
    const nb = sheet(page);
    await app.open();
    await app.input.fill('Could');
    await nb.open.click();
    await nb.field.fill('vazgeçilen');
    await nb.cancel.click();
    await expect(app.input).toHaveValue('Could');
    expect(await readStore(page, 'notebook')).toEqual([]);
  });
});

/** All fixture items answered and no open round → Home says "Bugün bitti". */
async function openDone(app: App, extra: Record<string, unknown[]> = {}): Promise<void> {
  await app.open();
  await seedStores(app.page, {
    put: { progress: answeredProgress(items.map((i) => i.id)), ...extra },
    delete: { session: ['current'] },
  });
  await app.page.reload();
  await expect(app.page.getByRole('heading', { name: t.todayDone })).toBeVisible();
}

async function downloadJson<T>(page: Page, button: string): Promise<{ name: string; json: T }> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button }).click()]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return { name: download.suggestedFilename(), json: JSON.parse(Buffer.concat(chunks).toString('utf8')) as T };
}

test.describe('notebook and flags export (Settings)', () => {
  test.beforeEach(async ({ page }) => disableWebShare(page));

  test('notebook export carries open entries with their context, converted ones left out', async ({ page }) => {
    const app = new App(page);
    const nb = sheet(page);
    await app.open();
    await nb.open.click();
    await nb.field.fill('sorunu ekibe yükseltmek');
    await nb.save.click();
    await expect(nb.field).toHaveCount(0);

    const converted: NotebookEntry = { id: 'old', textTr: 'eski', createdAt: 1, status: 'converted', convertedItemId: 'x' };
    await seedStores(page, {
      put: { progress: answeredProgress(items.map((i) => i.id)), notebook: [converted] },
      delete: { session: ['current'] },
    });
    await page.reload();

    await page.getByRole('button', { name: t.settings }).click();
    await expect(page.getByText(t.notebookPending)).toBeVisible();
    const { name, json } = await downloadJson<NotebookExportV1>(page, t.notebookExport);
    expect(name).toBe('english-pwa-notebook-2026-11-02.json');
    expect(json.format).toBe('english-pwa-notebook');
    expect(json.entries).toEqual([
      expect.objectContaining({ textTr: 'sorunu ekibe yükseltmek', contextTr: items[0]?.situationTr }),
    ]);
    await expect(page.getByText(t.exportDownloaded)).toBeVisible();

    await page.getByRole('button', { name: t.back, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.todayDone })).toBeVisible();
  });

  test('nothing to export: buttons are disabled, no counts shown', async ({ page }) => {
    const app = new App(page);
    await openDone(app);
    await page.getByRole('button', { name: t.settings }).click();
    await expect(page.getByText(t.notebookNothingPending)).toBeVisible();
    await expect(page.getByRole('button', { name: t.notebookExport })).toBeDisabled();
    await expect(page.getByRole('button', { name: t.flagsExport })).toBeDisabled();
  });

  test('flags report lists each flagged item with its canonical answer', async ({ page }) => {
    const app = new App(page);
    const flag: Flag = { itemId: items[1]?.id ?? '', flaggedAt: 5, screen: 'result', userAnswer: 'Could you to check', contentVersion: 'e2e-fixture' };
    await openDone(app, { flags: [flag] });
    await page.getByRole('button', { name: t.settings }).click();
    const { name, json } = await downloadJson<FlagsReportV1>(page, t.flagsExport);
    expect(name).toBe('english-pwa-flags-2026-11-02.json');
    expect(json.flags).toEqual([
      expect.objectContaining({ itemId: items[1]?.id, canonical: items[1]?.acceptedAnswers[0], targetChunk: items[1]?.targetChunk, userAnswer: 'Could you to check' }),
    ]);
  });

  test('"+ Deftere ekle" from Home saves without context', async ({ page }) => {
    const app = new App(page);
    await openDone(app);
    await page.getByRole('button', { name: t.notebookAdd }).click();
    const nb = sheet(page);
    await expect(nb.field).toBeFocused();
    await expect(page.getByText(t.notebookContext)).toHaveCount(0);
    await nb.field.fill('kapsam dışı');
    await nb.save.click();
    await expect(page.getByRole('heading', { name: t.todayDone })).toBeVisible();
    const stored = await readStore<NotebookEntry>(page, 'notebook');
    expect(stored).toHaveLength(1);
    expect(stored[0]?.contextTr).toBeUndefined();
  });
});

const IMPORT_FIXTURE = 'tests/e2e/fixtures/items-import.json';
const imported = (JSON.parse(readFileSync(IMPORT_FIXTURE, 'utf8')) as { items: Item[] }).items[0] as Item;
const pendingEntry: NotebookEntry = { id: 'nb-escalate', textTr: 'sorunu ekibe yükseltmek', createdAt: 1, status: 'open' };

test.describe('items import (Settings)', () => {
  test('notebookId entry becomes converted; the item is the first new card, asked as "İngilizcesi neydi?"', async ({ page }) => {
    const app = new App(page);
    await openDone(app, { notebook: [pendingEntry] });
    await page.getByRole('button', { name: t.settings }).click();
    await page.getByLabel(t.itemsChoose).setInputFiles(IMPORT_FIXTURE);

    await expect(page.getByText(t.itemsImported)).toBeVisible();
    // The bundled-content id is rejected and listed.
    await expect(page.locator('.import-rejected')).toContainText('e2e-will-send');
    await expect(page.locator('.import-rejected')).toContainText(t.rejectReasons['builtin-id']);
    const entries = await readStore<NotebookEntry>(page, 'notebook');
    expect(entries).toEqual([expect.objectContaining({ id: 'nb-escalate', status: 'converted', convertedItemId: imported.id })]);
    await expect(page.getByText(t.notebookNothingPending)).toBeVisible();

    // Back on Home the import has opened today's round with the new card first.
    await page.getByRole('button', { name: t.back, exact: true }).click();
    await app.resumeButton.click();
    await expect(page.getByText(t.userErrorHeading)).toBeVisible();
    await expect(app.situation).toHaveText(imported.situationTr.replace(/^\[[^\]]+\]\s*/, ''));
    // The field is labelled by the card heading, so here by "İngilizcesi neydi?".
    const field = page.getByRole('textbox', { name: t.userErrorHeading });
    await field.fill(imported.acceptedAnswers[0] ?? '');
    await field.press('Enter');
    await expect(page.locator('.verdict--ok')).toHaveText(new RegExp(t.correct));
  });

  test('pasting Claude’s reply (```json block with prose around it) imports like a file and clears the box', async ({ page }) => {
    const app = new App(page);
    await openDone(app, { notebook: [pendingEntry] });
    await page.getByRole('button', { name: t.settings }).click();
    await expect(page.getByText(t.claudeHelpSteps[2])).toBeVisible();

    const box = page.getByRole('textbox', { name: t.itemsPasteLabel });
    const submit = page.getByRole('button', { name: t.itemsPasteImport, exact: true });
    await expect(submit).toBeDisabled();

    await box.fill('Bunu henüz çözemedim.');
    await submit.click();
    await expect(page.getByRole('alert')).toContainText(t.importErrors['invalid-json']);
    await expect(box).toHaveValue('Bunu henüz çözemedim.'); // kept for another try
    expect(await readStore(page, 'importedItems')).toEqual([]);

    const reply = [
      'İşte defterindeki ifade için item dosyası:',
      '',
      '```json',
      readFileSync(IMPORT_FIXTURE, 'utf8').trimEnd(),
      '```',
      '',
      'Emin olmadıklarım:',
      '- "escalate" yerine "raise" da kullanılabilir.',
    ].join('\n');
    await box.fill(reply);
    await submit.click();

    await expect(page.getByText(t.itemsImported)).toBeVisible();
    await expect(page.locator('.import-rejected')).toContainText('e2e-will-send');
    await expect(box).toHaveValue('');
    const entries = await readStore<NotebookEntry>(page, 'notebook');
    expect(entries).toEqual([expect.objectContaining({ id: 'nb-escalate', status: 'converted', convertedItemId: imported.id })]);

    await page.getByRole('button', { name: t.back }).click();
    await app.resumeButton.click();
    await expect(page.getByText(t.userErrorHeading)).toBeVisible();
    await expect(app.situation).toHaveText(imported.situationTr.replace(/^\[[^\]]+\]\s*/, ''));
    await expect(page.getByRole('textbox', { name: t.userErrorHeading })).toBeVisible();
  });

  test('a new round puts the imported item before curated new cards', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00');
    await seedStores(page, { put: { progress: answeredProgress(items.map((i) => i.id)) }, delete: { session: ['current'] } });
    await page.reload();
    await page.getByRole('button', { name: t.settings }).click();
    await page.getByLabel(t.itemsChoose).setInputFiles(IMPORT_FIXTURE);
    await expect(page.getByText(t.itemsImported)).toBeVisible();

    // Next day, with curated cards new again: the imported one still comes first.
    await seedStores(page, { delete: { progress: items.map((i) => i.id), session: ['current'] } });
    await page.clock.setSystemTime(new Date('2026-11-03T08:00:00'));
    await page.reload();
    await app.start();
    await expect(page.getByText(t.userErrorHeading)).toBeVisible();
    await expect(app.situation).toHaveText(imported.situationTr.replace(/^\[[^\]]+\]\s*/, ''));
  });

  test('a broken file shows the error and writes nothing', async ({ page }) => {
    const app = new App(page);
    await openDone(app, { notebook: [pendingEntry] });
    await page.getByRole('button', { name: t.settings }).click();
    const input = page.getByLabel(t.itemsChoose);

    await input.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"format": "english-pwa-items",') });
    await expect(page.getByRole('alert')).toContainText(t.importErrors['invalid-json']);

    const bad = { format: 'english-pwa-items', schemaVersion: 1, items: [{ ...imported, level: 7 }] };
    await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
    await expect(page.getByRole('alert')).toContainText(t.importErrors.invalid);
    await expect(page.getByRole('alert')).toContainText('items[0].level');

    const newer = { format: 'english-pwa-items', schemaVersion: 2, items: [imported] };
    await input.setInputFiles({ name: 'v2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(newer)) });
    await expect(page.getByRole('alert')).toContainText(t.importErrors['unsupported-version']);

    expect(await readStore(page, 'importedItems')).toEqual([]);
    expect((await readStore<NotebookEntry>(page, 'notebook'))[0]?.status).toBe('open');
  });
});
