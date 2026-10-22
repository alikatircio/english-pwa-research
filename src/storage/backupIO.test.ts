import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { FlagsReportSchema, type ImportedItem } from '../domain/backup.ts';
import type { Item } from '../domain/types.ts';
import { BACKUP_STORES, exportFlagsReport, importItems, readBackupData, writeRestore } from './backupIO.ts';
import { openAppDb, type AppDb } from './db.ts';

let n = 0;
const opened: AppDb[] = [];
async function freshDb(): Promise<AppDb> {
  const db = await openAppDb({ name: `backupio-${++n}-${Date.now()}` });
  opened.push(db);
  return db;
}
afterEach(() => {
  while (opened.length) opened.pop()?.close();
});

const item = {
  id: 'a',
  targetChunk: 'remind someone to',
  situationTr: 'durum',
  acceptedAnswers: ['Remind him to go.'],
} as Item;

describe('exportFlagsReport', () => {
  it('joins every stored flag with its item, oldest first, and validates as a flags report', async () => {
    const db = await freshDb();
    await db.put('flags', { itemId: 'gone', flaggedAt: 20, screen: 'result', userAnswer: 'x', contentVersion: 'v1' });
    await db.put('flags', { itemId: 'a', flaggedAt: 10, screen: 'question', contentVersion: 'v1' });
    const report = await exportFlagsReport(db, new Map([['a', item]]), 'v2', Date.UTC(2026, 10, 2));
    expect(report.contentVersion).toBe('v2');
    expect(report.flags.map((f) => f.itemId)).toEqual(['a', 'gone']);
    expect(report.flags[0]).toMatchObject({ targetChunk: 'remind someone to', situationTr: 'durum', canonical: 'Remind him to go.' });
    expect(report.flags[1]).toMatchObject({ targetChunk: '', canonical: '', userAnswer: 'x' });
    expect(FlagsReportSchema.safeParse(report).success).toBe(true);
  });

  it('an empty store gives an empty report', async () => {
    const db = await freshDb();
    expect((await exportFlagsReport(db, new Map(), 'v', 0)).flags).toEqual([]);
  });
});

describe('importItems', () => {
  const imported = { ...item, id: 'n1', source: 'user-error', verified: true, verifiedNote: 'user-import', importedAt: 9 } as ImportedItem;

  it('writes items and converts notebook entries together', async () => {
    const db = await freshDb();
    await db.put('notebook', { id: 'e1', textTr: 'x', createdAt: 1, status: 'open' });
    await importItems(db, { items: [imported], notebookUpdates: [{ id: 'e1', textTr: 'x', createdAt: 1, status: 'converted', convertedItemId: 'n1' }] });
    expect(await db.get('importedItems', 'n1')).toMatchObject({ id: 'n1', importedAt: 9 });
    expect(await db.get('notebook', 'e1')).toMatchObject({ status: 'converted', convertedItemId: 'n1' });
  });

  it('writes nothing when one write fails (single transaction)', async () => {
    const db = await freshDb();
    await db.put('notebook', { id: 'e1', textTr: 'x', createdAt: 1, status: 'open' });
    // An entry without its key path makes put() throw inside the transaction.
    const broken = { textTr: 'y', createdAt: 2, status: 'converted' } as unknown as ImportedItem & { id: string };
    await expect(
      importItems(db, { items: [imported], notebookUpdates: [{ id: 'e1', textTr: 'x', createdAt: 1, status: 'converted' }, broken as never] }),
    ).rejects.toThrow();
    expect(await db.get('importedItems', 'n1')).toBeUndefined();
    expect((await db.get('notebook', 'e1'))?.status).toBe('open');
  });
});

describe('readBackupData / writeRestore (T5.4)', () => {
  const progress = { itemId: 'p1', box: 2, dueOn: '2026-11-04', introducedOn: '2026-11-02', lastAnsweredOn: '2026-11-02', lastGrade: 'correct', updatedAt: 1 } as const;
  const log = { at: 5, day: '2026-11-02', itemId: 'p1', answer: 'x', grade: 'correct', gradedBy: 'auto', hintStage: 1, isRepeat: false, boxBefore: null, boxAfter: 2 } as const;
  const empty = { progress: [], dailyCounters: [], notebook: [], flags: [], answerLog: [], importedItems: [] };

  async function seeded(): Promise<AppDb> {
    const db = await freshDb();
    await db.put('progress', progress);
    await db.put('dailyCounters', { day: '2026-11-02', newIntroduced: 1, reviewsAnswered: 0 });
    await db.put('notebook', { id: 'e1', textTr: 'x', createdAt: 1, status: 'open' });
    await db.put('flags', { itemId: 'p1', flaggedAt: 3, screen: 'result', contentVersion: 'v' });
    await db.add('answerLog', log);
    await db.put('importedItems', { ...imported(), id: 'u1' });
    await db.put('session', { key: 'current' } as never);
    await db.put('meta', { key: 'lastExportAt', value: 7 });
    return db;
  }

  function imported(): ImportedItem {
    return { ...item, id: 'n1', source: 'user-error', verified: true, verifiedNote: 'user-import', importedAt: 9 } as ImportedItem;
  }

  it('reads every backup store in one go (session and meta are not part of a backup)', async () => {
    const db = await seeded();
    const data = await readBackupData(db);
    expect(data.progress).toEqual([progress]);
    expect(data.dailyCounters).toHaveLength(1);
    expect(data.notebook.map((e) => e.id)).toEqual(['e1']);
    expect(data.flags.map((f) => f.itemId)).toEqual(['p1']);
    expect(data.answerLog).toEqual([{ ...log, id: 1 }]);
    expect(data.importedItems.map((i) => i.id)).toEqual(['u1']);
    expect(Object.keys(data).sort()).toEqual([...BACKUP_STORES].sort());
  });

  it('replaces every backup store, assigns ids to new log rows, keeps meta, optionally drops the session', async () => {
    const db = await seeded();
    const noId = { ...log, at: 99 };
    await writeRestore(db, {
      data: { ...empty, answerLog: [{ ...log, id: 1 }, noId], importedItems: [imported()] },
      clearSession: true,
      meta: [{ key: 'firstRunAt', value: 11 }],
    });
    expect(await db.getAll('progress')).toEqual([]);
    expect(await db.getAll('notebook')).toEqual([]);
    expect((await db.getAll('answerLog')).map((l) => [l.id, l.at])).toEqual([
      [1, 5],
      [2, 99],
    ]);
    expect((await db.getAll('importedItems')).map((i) => i.id)).toEqual(['n1']);
    expect(await db.get('session', 'current')).toBeUndefined();
    expect(await db.get('meta', 'lastExportAt')).toEqual({ key: 'lastExportAt', value: 7 });
    expect(await db.get('meta', 'firstRunAt')).toEqual({ key: 'firstRunAt', value: 11 });
  });

  it('keeps the session when asked to', async () => {
    const db = await seeded();
    await writeRestore(db, { data: empty, clearSession: false });
    expect(await db.get('session', 'current')).toBeDefined();
  });

  it('writes nothing (not even the clears) when one row fails', async () => {
    const db = await seeded();
    const before = await readBackupData(db);
    const broken = { textTr: 'no id', createdAt: 2, status: 'open' } as never;
    await expect(writeRestore(db, { data: { ...empty, progress: [progress], notebook: [broken] }, clearSession: true })).rejects.toThrow();
    expect(await readBackupData(db)).toEqual(before);
    expect(await db.get('session', 'current')).toBeDefined();
  });
});
