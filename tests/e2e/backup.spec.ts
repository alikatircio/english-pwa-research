import { expect, test, type Page } from '@playwright/test';
import type { BackupFileV1 } from '../../src/domain/backup.ts';
import type { NotebookEntry, Progress } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, items } from './helpers/app.ts';
import { readStore } from './helpers/db.ts';
import { disableWebShare, seedStores } from './helpers/seed.ts';

// Full backup in Settings (T5.4, T5.6): export, "Birleştir", "Tümünü değiştir"
// behind a second confirmation, and an invalid file that changes nothing.

const id = (i: number): string => items[i]?.id ?? '';

const prog = (itemId: string, box: Progress['box'], lastAnsweredOn = '2026-11-01'): Progress => ({
  itemId,
  box,
  dueOn: '2026-11-20',
  introducedOn: '2026-10-25',
  lastAnsweredOn,
  lastGrade: 'correct',
  updatedAt: 1,
});

const localNote: NotebookEntry = { id: 'local-note', textTr: 'yerel not', createdAt: 1, status: 'open' };

function backupFile(data: Partial<BackupFileV1['data']>): BackupFileV1 {
  return {
    format: 'english-pwa-backup',
    schemaVersion: 1,
    exportedAt: '2026-10-30T10:00:00.000Z',
    appVersion: '0.0.0',
    contentVersion: 'e2e-fixture',
    data: { progress: [], dailyCounters: [], notebook: [], flags: [], answerLog: [], importedItems: [], ...data },
  };
}

const asFile = (name: string, body: unknown) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
});

/** Home with local data (one progress row, one notebook entry), then Settings. */
async function openSettingsWithLocalData(page: Page): Promise<App> {
  const app = new App(page);
  await app.open('2026-11-02T08:00:00', { start: false });
  await seedStores(page, { put: { progress: [prog(id(0), 2)], notebook: [localNote] } });
  await page.reload();
  await page.getByRole('button', { name: t.settings }).click();
  return app;
}

const fileInput = (page: Page) => page.getByTestId('backup-file');
const sortedIds = (rows: Progress[]) => rows.map((p) => p.itemId).sort();

test.describe('full backup (Settings)', () => {
  test.beforeEach(async ({ page }) => disableWebShare(page));

  test('export downloads a valid backup of everything and records the export time', async ({ page }) => {
    await openSettingsWithLocalData(page);
    const exportButton = page.getByRole('button', { name: t.backupExport });
    await expect(exportButton).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
    expect(download.suggestedFilename()).toBe('english-pwa-backup-2026-11-02.json');
    const chunks: Buffer[] = [];
    for await (const c of await download.createReadStream()) chunks.push(c as Buffer);
    const json = JSON.parse(Buffer.concat(chunks).toString('utf8')) as BackupFileV1;
    expect(json.format).toBe('english-pwa-backup');
    expect(json.schemaVersion).toBe(1);
    expect(json.data.progress.map((p) => p.itemId)).toEqual([id(0)]);
    expect(json.data.notebook).toEqual([localNote]);
    expect(json).not.toHaveProperty('data.session');
    await expect(page.getByText(t.exportDownloaded)).toBeVisible();
    const meta = await readStore<{ key: string; value: unknown }>(page, 'meta');
    const exportedAt = meta.find((m) => m.key === 'lastExportAt')?.value as number;
    const t0 = new Date('2026-11-02T08:00:00').getTime(); // the installed clock keeps running
    expect(exportedAt).toBeGreaterThanOrEqual(t0);
    expect(exportedAt).toBeLessThan(t0 + 60_000);
  });

  test('"Birleştir" keeps local data and adds the backup’s', async ({ page }) => {
    await openSettingsWithLocalData(page);
    const incoming = backupFile({
      progress: [prog(id(0), 5, '2026-11-02'), prog(id(1), 3)],
      notebook: [{ id: 'backup-note', textTr: 'yedekteki not', createdAt: 2, status: 'open' }],
    });
    await fileInput(page).setInputFiles(asFile('backup.json', incoming));
    await expect(page.getByText(t.backupChooseMode)).toBeVisible();
    await page.getByRole('button', { name: t.backupMerge }).click();
    await expect(page.getByText(t.backupRestored)).toBeVisible();

    const progress = await readStore<Progress>(page, 'progress');
    expect(sortedIds(progress)).toEqual([id(0), id(1)].sort());
    expect(progress.find((p) => p.itemId === id(0))?.box).toBe(5); // later lastAnsweredOn wins
    expect((await readStore<NotebookEntry>(page, 'notebook')).map((e) => e.id).sort()).toEqual(['backup-note', 'local-note']);

    // The reloaded state is what Home shows after going back.
    await page.getByRole('button', { name: t.back, exact: true }).click();
    await expect(page.getByTestId('today-count')).toBeVisible();
  });

  test('"Tümünü değiştir" asks again; only the second confirmation replaces everything', async ({ page }) => {
    await openSettingsWithLocalData(page);
    const incoming = backupFile({ progress: [prog(id(2), 4)] });
    await fileInput(page).setInputFiles(asFile('backup.json', incoming));

    await page.getByRole('button', { name: t.backupReplace }).click();
    await expect(page.getByText(t.backupReplaceConfirm)).toBeVisible();
    expect(sortedIds(await readStore<Progress>(page, 'progress'))).toEqual([id(0)]); // nothing written yet

    await page.getByRole('button', { name: t.backupCancel }).click();
    await expect(page.getByText(t.backupReplaceConfirm)).toHaveCount(0);
    expect(sortedIds(await readStore<Progress>(page, 'progress'))).toEqual([id(0)]);

    await fileInput(page).setInputFiles(asFile('backup.json', incoming));
    await page.getByRole('button', { name: t.backupReplace }).click();
    await page.getByRole('button', { name: t.backupReplaceYes }).click();
    await expect(page.getByText(t.backupRestored)).toBeVisible();
    expect(sortedIds(await readStore<Progress>(page, 'progress'))).toEqual([id(2)]);
    expect(await readStore(page, 'notebook')).toEqual([]);
  });

  test('an invalid file shows a Turkish error and changes nothing', async ({ page }) => {
    await openSettingsWithLocalData(page);
    const before = { progress: await readStore(page, 'progress'), notebook: await readStore(page, 'notebook') };

    await fileInput(page).setInputFiles(asFile('broken.json', '{"format": "english-pwa-backup",'));
    await expect(page.getByRole('alert')).toContainText(t.backupImportErrors['invalid-json']);

    await fileInput(page).setInputFiles(asFile('items.json', { format: 'english-pwa-items', schemaVersion: 1, items: [] }));
    await expect(page.getByRole('alert')).toContainText(t.backupImportErrors['wrong-format']);

    const bad = backupFile({ progress: [{ ...prog(id(1), 3), box: 9 as Progress['box'] }] });
    await fileInput(page).setInputFiles(asFile('bad.json', bad));
    await expect(page.getByRole('alert')).toContainText(t.backupImportErrors.invalid);
    await expect(page.getByRole('alert')).toContainText('data.progress[0].box');

    await fileInput(page).setInputFiles(asFile('v2.json', { ...backupFile({}), schemaVersion: 2 }));
    await expect(page.getByRole('alert')).toContainText(t.backupImportErrors['unsupported-version']);

    await expect(page.getByRole('button', { name: t.backupMerge })).toHaveCount(0);
    expect({ progress: await readStore(page, 'progress'), notebook: await readStore(page, 'notebook') }).toEqual(before);
  });
});
