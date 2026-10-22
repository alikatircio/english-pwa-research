import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { FlagsReportSchema, type ImportedItem } from '../domain/backup.ts';
import type { Item } from '../domain/types.ts';
import { exportFlagsReport, importItems } from './backupIO.ts';
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
