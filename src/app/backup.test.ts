import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import fixture from '../../content/fixtures/e2e-items.json';
import { BackupFileSchema, type BackupFileV1, type ImportedItem } from '../domain/backup.ts';
import { fixedClock } from '../domain/clock.ts';
import type { ContentBundle, Progress } from '../domain/types.ts';
import { readBackupData } from '../storage/backupIO.ts';
import { openAppDb } from '../storage/db.ts';
import { createActions } from './actions.ts';
import { boot } from './boot.ts';
import type { ReadyState } from './state.ts';
import { createStore } from './store.ts';

const bundle = fixture as ContentBundle;
const ids = bundle.items.map((i) => i.id);
const id0 = ids[0] ?? '';
const id1 = ids[1] ?? '';
const T0 = new Date(2026, 10, 2, 8).getTime();

const prog = (itemId: string, box: Progress['box'], lastAnsweredOn: string, updatedAt = 1): Progress => ({
  itemId, box, dueOn: '2026-11-10', introducedOn: '2026-10-20', lastAnsweredOn, lastGrade: 'correct', updatedAt,
});

const userItem = (id: string): ImportedItem => ({
  ...(bundle.items[0] as ContentBundle['items'][number]),
  id,
  source: 'user-error',
  verified: true,
  verifiedNote: 'user-import',
  importedAt: 5,
});

let n = 0;
async function setup(seed: { progress?: Progress[]; session?: boolean } = {}) {
  const name = `backup-actions-${++n}-${Date.now()}`;
  const db0 = await openAppDb({ name });
  for (const p of seed.progress ?? []) await db0.put('progress', p);
  await db0.put('notebook', { id: 'local-note', textTr: 'yerel', createdAt: 1, status: 'open' });
  db0.close();
  const clock = fixedClock(T0);
  const { db, state } = await boot({ bundle, clock, openDb: () => openAppDb({ name }) });
  const store = createStore();
  store.dispatch({ type: 'booted', state });
  const actions = createActions({ db, clock, getState: store.getState, dispatch: store.dispatch });
  if (seed.session) actions.startRound();
  const ready = (): ReadyState => {
    const s = store.getState();
    if (s.status !== 'ready') throw new Error('not ready');
    return s;
  };
  return { db, clock, actions, ready };
}

function backupWith(data: Partial<BackupFileV1['data']>): BackupFileV1 {
  return {
    format: 'english-pwa-backup',
    schemaVersion: 1,
    exportedAt: '2026-11-01T10:00:00.000Z',
    appVersion: '0.0.0',
    contentVersion: 'e2e-fixture',
    data: { progress: [], dailyCounters: [], notebook: [], flags: [], answerLog: [], importedItems: [], ...data },
  };
}

describe('backup export (T5.4)', () => {
  it('builds a valid english-pwa-backup file of everything on disk, named by day', async () => {
    const app = await setup({ progress: [prog(id0, 3, '2026-11-01')] });
    const file = await app.actions.prepareBackup();
    expect(file?.filename).toBe('english-pwa-backup-2026-11-02.json');
    const parsed = BackupFileSchema.parse(JSON.parse(file?.text ?? ''));
    expect(parsed.data.progress.map((p) => p.itemId)).toEqual([id0]);
    expect(parsed.data.notebook.map((e) => e.id)).toEqual(['local-note']);
    expect(parsed.contentVersion).toBe('e2e-fixture');
    app.db.close();
  });

  it('markBackupExported stores lastExportAt in meta and in memory', async () => {
    const app = await setup();
    expect(app.ready().meta.lastExportAt).toBeUndefined();
    await app.actions.markBackupExported();
    expect(await app.db.get('meta', 'lastExportAt')).toEqual({ key: 'lastExportAt', value: T0 });
    expect(app.ready().meta.lastExportAt).toBe(T0);
    app.db.close();
  });

  it('an exported file restores into an empty device unchanged (round trip)', async () => {
    const src = await setup({ progress: [prog(id0, 4, '2026-11-01')] });
    const text = (await src.actions.prepareBackup())?.text ?? '';
    const before = await readBackupData(src.db);
    src.db.close();

    const dst = await setup();
    const checked = dst.actions.checkBackupFile(text);
    if (checked.status !== 'valid') throw new Error('expected valid');
    expect(await dst.actions.restoreBackup(checked.file, 'replace')).toEqual({ status: 'restored', rejected: [] });
    expect(await readBackupData(dst.db)).toEqual(before);
    dst.db.close();
  });
});

describe('backup import (T5.4)', () => {
  it('an invalid file is reported with codes and nothing is written', async () => {
    const app = await setup({ progress: [prog(id0, 2, '2026-11-01')] });
    const before = await readBackupData(app.db);
    expect(app.actions.checkBackupFile('{ not json')).toMatchObject({ status: 'invalid', errors: [{ code: 'invalid-json' }] });
    expect(app.actions.checkBackupFile(JSON.stringify({ format: 'english-pwa-items', schemaVersion: 1, items: [] }))).toMatchObject({
      status: 'invalid',
      errors: [{ code: 'wrong-format' }],
    });
    const broken = { ...backupWith({}), data: { ...backupWith({}).data, progress: [{ itemId: 'x', box: 9 }] } };
    const r = app.actions.checkBackupFile(JSON.stringify(broken));
    expect(r.status).toBe('invalid');
    if (r.status === 'invalid') expect(r.errors.every((e) => e.code === 'invalid' && e.path.startsWith('data.progress[0]'))).toBe(true);
    expect(await readBackupData(app.db)).toEqual(before);
    app.db.close();
  });

  it('"Birleştir" merges per store, keeps the open round and reloads state', async () => {
    const app = await setup({ progress: [prog(id0, 2, '2026-11-01')], session: true });
    const session = app.ready().session;
    expect(session).toBeDefined();
    const file = backupWith({
      progress: [prog(id0, 5, '2026-11-02'), prog(id1, 3, '2026-10-30')],
      notebook: [
        { id: 'local-note', textTr: 'yedekteki', createdAt: 1, status: 'open' },
        { id: 'backup-note', textTr: 'yeni', createdAt: 2, status: 'open' },
      ],
      importedItems: [userItem('user-1'), userItem(id0)],
    });
    const result = await app.actions.restoreBackup(file, 'merge');
    expect(result).toEqual({ status: 'restored', rejected: [{ id: id0, reason: 'builtin-id' }] });

    const s = app.ready();
    expect(s.progress.get(id0)?.box).toBe(5); // later lastAnsweredOn wins
    expect(s.progress.get(id1)?.box).toBe(3);
    expect(s.notebook.map((e) => [e.id, e.textTr])).toEqual([
      ['local-note', 'yerel'],
      ['backup-note', 'yeni'],
    ]);
    expect(s.catalog.byId.has('user-1')).toBe(true);
    expect(s.session?.queue).toEqual(session?.queue);
    expect(s.busy).toBe(false);
    expect(s.meta.firstRunAt).toBe(T0);
    expect((await app.db.get('session', 'current'))?.queue).toEqual(session?.queue);
    app.db.close();
  });

  it('"Tümünü değiştir" makes the file the whole data and drops the open round', async () => {
    const app = await setup({ progress: [prog(id0, 2, '2026-11-01')], session: true });
    const file = backupWith({ progress: [prog(id1, 4, '2026-10-30')], importedItems: [userItem('user-2')] });
    expect(await app.actions.restoreBackup(file, 'replace')).toEqual({ status: 'restored', rejected: [] });
    const s = app.ready();
    expect([...s.progress.keys()]).toEqual([id1]);
    expect(s.notebook).toEqual([]);
    expect(s.session).toBeUndefined();
    expect(await app.db.get('session', 'current')).toBeUndefined();
    expect(s.catalog.imported.map((i) => i.id)).toEqual(['user-2']);
    app.db.close();
  });

  it('a failed write leaves the data and the in-memory state as they were', async () => {
    const app = await setup({ progress: [prog(id0, 2, '2026-11-01')] });
    const before = await readBackupData(app.db);
    const progressBefore = app.ready().progress;
    // A notebook row without its key path makes put() throw inside the transaction.
    const file = backupWith({ progress: [prog(id1, 4, '2026-10-30')], notebook: [{ textTr: 'x' } as never] });
    expect(await app.actions.restoreBackup(file, 'replace')).toEqual({ status: 'save-failed' });
    expect(await readBackupData(app.db)).toEqual(before);
    expect(app.ready().progress).toBe(progressBefore);
    expect(app.ready().error).toBe('save-failed');
    app.db.close();
  });
});
