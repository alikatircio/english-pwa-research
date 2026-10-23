import { expect, test } from '@playwright/test';
import type { BackupFileV1 } from '../../src/domain/backup.ts';
import type { Progress } from '../../src/domain/types.ts';
import { t } from '../../src/ui/strings.tr.ts';
import { App, items } from './helpers/app.ts';
import { readStore } from './helpers/db.ts';
import { disableWebShare, seedStores } from './helpers/seed.ts';

// T5.5: first-run welcome, persistent storage, install hint, backup reminder.

type Meta = { key: string; value: unknown };
const metaValue = async (page: import('@playwright/test').Page, key: string) =>
  (await readStore<Meta>(page, 'meta')).find((m) => m.key === key)?.value;

const prog = (itemId: string, introducedOn: string): Progress => ({
  itemId,
  box: 2,
  dueOn: '2026-12-01',
  introducedOn,
  lastAnsweredOn: introducedOn,
  lastGrade: 'correct',
  updatedAt: 1,
});

test.describe('first run', () => {
  test('an empty device shows the welcome; the first "Başla" asks for persistent storage and the welcome is gone', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false });
    await expect(page.getByTestId('welcome')).toContainText(t.welcome);
    await expect(page.getByTestId('welcome').getByRole('button', { name: t.backupRestore })).toBeVisible();

    await app.start();
    await expect.poll(() => metaValue(page, 'firstRunAt')).toEqual(expect.any(Number));
    await expect.poll(() => metaValue(page, 'persist')).toEqual(expect.any(Boolean));

    await page.reload();
    await expect(app.resumeButton).toBeVisible();
    await expect(page.getByTestId('welcome')).toHaveCount(0);
  });

  test('"Yedekten geri yükle" on the welcome restores a backup', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false });
    const backup: BackupFileV1 = {
      format: 'english-pwa-backup',
      schemaVersion: 1,
      exportedAt: '2026-11-01T10:00:00.000Z',
      appVersion: '0.0.0',
      contentVersion: 'e2e-fixture',
      data: {
        progress: [prog(items[0]?.id ?? '', '2026-10-30')],
        dailyCounters: [],
        notebook: [{ id: 'n1', textTr: 'yedekten', createdAt: 1, status: 'open' }],
        flags: [],
        answerLog: [],
        importedItems: [],
      },
    };
    await page
      .getByTestId('backup-file')
      .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.getByRole('button', { name: t.backupMerge }).click();
    await expect(page.getByTestId('welcome')).toHaveCount(0);
    expect((await readStore<Progress>(page, 'progress')).map((p) => p.itemId)).toEqual([items[0]?.id]);
    await expect(app.startButton).toBeVisible();
  });
});

test.describe('install hint', () => {
  test('shown outside standalone mode; "Kapat" hides it for good', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false });
    const hint = page.getByTestId('install-hint');
    await expect(hint).toHaveText(new RegExp(t.installHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await hint.getByRole('button', { name: t.dismiss }).click();
    await expect(hint).toHaveCount(0);
    await page.reload();
    await expect(app.todayCount).toBeVisible();
    await expect(hint).toHaveCount(0);
  });

  test('not shown when launched from the home screen (navigator.standalone)', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { value: true, configurable: true }));
    const app = new App(page);
    await app.open('2026-11-02T08:00:00', { start: false });
    await expect(page.getByTestId('install-hint')).toHaveCount(0);
  });
});

test.describe('backup reminder (decision 27)', () => {
  test.beforeEach(async ({ page }) => disableWebShare(page));

  test('no export and first answer > 7 days ago → plain line; "Kapat" hides it; an export clears it', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-12T08:00:00', { start: false });
    await seedStores(page, { put: { progress: [prog(items[0]?.id ?? '', '2026-11-02')] } });
    await page.reload();
    const reminder = page.getByTestId('backup-reminder');
    await expect(reminder).toContainText(t.backupReminder);
    await reminder.getByRole('button', { name: t.dismiss }).click();
    await expect(reminder).toHaveCount(0);
    await page.reload();
    await expect(app.todayCount).toBeVisible();
    await expect(reminder).toHaveCount(0);
    expect(await metaValue(page, 'backupReminderDismissedAt')).toEqual(expect.any(Number));

    // Settings always shows the last backup; after an export it carries the date.
    await page.getByRole('button', { name: t.settings }).click();
    await expect(page.getByTestId('last-backup')).toHaveText(t.lastBackupNever);
    await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: t.backupExport }).click()]);
    await expect(page.getByTestId('last-backup')).toHaveText(t.lastBackup('12 Kasım 2026'));
  });

  test('first answer exactly 7 days ago → no line yet', async ({ page }) => {
    const app = new App(page);
    await app.open('2026-11-09T08:00:00', { start: false });
    await seedStores(page, { put: { progress: [prog(items[0]?.id ?? '', '2026-11-02')] } });
    await page.reload();
    await expect(app.todayCount).toBeVisible();
    await expect(page.getByTestId('backup-reminder')).toHaveCount(0);
  });
});

test('Settings shows persistent storage as one line and can ask for it', async ({ page }) => {
  const app = new App(page);
  await app.open('2026-11-02T08:00:00', { start: false });
  await page.getByRole('button', { name: t.settings }).click();
  const line = page.getByTestId('persist-state');
  await expect(line).toHaveText(t.persistOff); // never asked yet
  const ask = page.getByRole('button', { name: t.persistRequest });
  await ask.click();
  await expect.poll(() => metaValue(page, 'persist')).toEqual(expect.any(Boolean));
  const granted = (await metaValue(page, 'persist')) === true;
  await expect(line).toHaveText(granted ? t.persistOn : t.persistOff);
});

test.describe('backup reminder: "Şimdi yedekle"', () => {
  test('taps share with the full backup, records lastExportAt and hides the note', async ({ page }) => {
    // A working Web Share: the call must happen inside the tap (iOS), so it is recorded with the file name.
    await page.addInitScript(() => {
      const w = window as unknown as { __shared: string[] };
      w.__shared = [];
      Object.defineProperty(Navigator.prototype, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(Navigator.prototype, 'share', {
        value: (data: { files?: File[] }) => {
          w.__shared.push(...(data.files ?? []).map((f) => f.name));
          return Promise.resolve();
        },
        configurable: true,
      });
    });
    const app = new App(page);
    await app.open('2026-11-12T08:00:00', { start: false });
    const oldExport = new Date('2026-11-01T08:00:00').getTime();
    await seedStores(page, {
      put: { progress: [prog(items[0]?.id ?? '', '2026-11-02')], meta: [{ key: 'lastExportAt', value: oldExport }] },
    });
    await page.reload();

    const reminder = page.getByTestId('backup-reminder');
    const button = reminder.getByRole('button', { name: t.backupNow });
    await expect(button).toBeEnabled();
    await button.click();

    await expect(reminder).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __shared: string[] }).__shared)).toEqual(['english-pwa-backup-2026-11-12.json']);
    expect(await metaValue(page, 'lastExportAt')).toBeGreaterThan(oldExport);
    await page.reload();
    await expect(app.todayCount).toBeVisible();
    await expect(reminder).toHaveCount(0);
  });
});
