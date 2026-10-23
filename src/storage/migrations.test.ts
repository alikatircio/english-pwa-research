import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { openAppDb, type AppDb } from './db.ts';

// Frozen v1 schema: written out here on purpose, never imported from migrations.ts.
async function createV1(name: string): Promise<void> {
  const v1 = await openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore('progress', { keyPath: 'itemId' });
      db.createObjectStore('dailyCounters', { keyPath: 'day' });
      db.createObjectStore('notebook', { keyPath: 'id' }).createIndex('by-createdAt', 'createdAt');
      db.createObjectStore('flags', { keyPath: 'itemId' });
      db.createObjectStore('answerLog', { keyPath: 'id', autoIncrement: true }).createIndex('by-day', 'day');
      db.createObjectStore('importedItems', { keyPath: 'id' });
      db.createObjectStore('session', { keyPath: 'key' });
      db.createObjectStore('meta', { keyPath: 'key' });
    },
  });
  await v1.put('progress', { itemId: 'a', box: 3, dueOn: '2026-11-05', introducedOn: '2026-11-01', lastAnsweredOn: '2026-11-02', lastGrade: 'correct', updatedAt: 5 });
  await v1.put('notebook', { id: 'n1', textTr: 'merhaba', createdAt: 7, status: 'open' });
  await v1.add('answerLog', { at: 9, day: '2026-11-02', itemId: 'a', answer: 'x', grade: 'correct', gradedBy: 'auto', isRepeat: false, boxBefore: 2, boxAfter: 3 });
  await v1.put('session', { key: 'current', cursor: 4 });
  await v1.put('dailyCounters', { day: '2026-11-02', newIntroduced: 2, reviewsAnswered: 3 });
  await v1.put('flags', { itemId: 'a', flaggedAt: 11, screen: 'result', contentVersion: 'v1' });
  await v1.put('meta', { key: 'firstRunAt', value: 123 });
  await v1.put('importedItems', { id: 'u1', importedAt: 13 });
  v1.close();
}

let db: AppDb | undefined;
afterEach(() => {
  db?.close();
  db = undefined;
});

describe('migration v1 -> v2', () => {
  it('adds only diagnosticAttempts and keeps every record', async () => {
    const name = `mig-${Date.now()}`;
    await createV1(name);
    db = await openAppDb({ name });
    expect(db.version).toBe(2);
    expect([...db.objectStoreNames].sort()).toEqual([
      'answerLog', 'dailyCounters', 'diagnosticAttempts', 'flags', 'importedItems', 'meta', 'notebook', 'progress', 'session',
    ]);
    expect(await db.getAll('diagnosticAttempts')).toEqual([]);
    expect(db.transaction('diagnosticAttempts').store.keyPath).toBe('id');

    expect(await db.get('progress', 'a')).toMatchObject({ box: 3, updatedAt: 5 });
    expect(await db.getAll('notebook')).toEqual([{ id: 'n1', textTr: 'merhaba', createdAt: 7, status: 'open' }]);
    expect(await db.getAll('answerLog')).toEqual([
      { id: 1, at: 9, day: '2026-11-02', itemId: 'a', answer: 'x', grade: 'correct', gradedBy: 'auto', isRepeat: false, boxBefore: 2, boxAfter: 3 },
    ]);
    expect(await db.get('session', 'current')).toEqual({ key: 'current', cursor: 4 });
    expect(await db.get('dailyCounters', '2026-11-02')).toEqual({ day: '2026-11-02', newIntroduced: 2, reviewsAnswered: 3 });
    expect(await db.get('flags', 'a')).toMatchObject({ flaggedAt: 11 });
    expect(await db.get('meta', 'firstRunAt')).toEqual({ key: 'firstRunAt', value: 123 });
    expect(await db.get('importedItems', 'u1')).toEqual({ id: 'u1', importedAt: 13 });

    const tx = db.transaction(['answerLog', 'notebook']);
    expect([...tx.objectStore('answerLog').indexNames]).toEqual(['by-day']);
    expect([...tx.objectStore('notebook').indexNames]).toEqual(['by-createdAt']);
    expect(await tx.objectStore('answerLog').index('by-day').count('2026-11-02')).toBe(1);
  });
});
