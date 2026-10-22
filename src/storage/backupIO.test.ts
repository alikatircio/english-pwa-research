import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { FlagsReportSchema } from '../domain/backup.ts';
import type { Item } from '../domain/types.ts';
import { exportFlagsReport } from './backupIO.ts';
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
