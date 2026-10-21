import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { AnswerLog, DailyCounter, Progress } from '../domain/types.ts';
import { DB_VERSION, openAppDb, STORE_NAMES, type AppDb } from './db.ts';
import { clearSession, commitGrade, loadAll, saveSession } from './repo.ts';
import { newSession } from '../domain/session.ts';

let n = 0;
const opened: AppDb[] = [];
async function freshDb(): Promise<AppDb> {
  const db = await openAppDb({ name: `test-${++n}-${Date.now()}` });
  opened.push(db);
  return db;
}
afterEach(() => {
  while (opened.length) opened.pop()?.close();
});

const day = '2026-11-02';
const progress: Progress = { itemId: 'a', box: 2, dueOn: '2026-11-04', introducedOn: day, lastAnsweredOn: day, lastGrade: 'correct', updatedAt: 1 };
const counter: DailyCounter = { day, newIntroduced: 1, reviewsAnswered: 0 };
const log: AnswerLog = { at: 1, day, itemId: 'a', answer: 'x', grade: 'correct', gradedBy: 'auto', hintStage: 1, isRepeat: false, boxBefore: null, boxAfter: 2 };

describe('schema v1', () => {
  it('creates all 8 stores with their keys and indexes', async () => {
    const db = await freshDb();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual([...STORE_NAMES].sort());
    const tx = db.transaction([...STORE_NAMES], 'readonly');
    expect(tx.objectStore('progress').keyPath).toBe('itemId');
    expect(tx.objectStore('dailyCounters').keyPath).toBe('day');
    expect(tx.objectStore('answerLog').autoIncrement).toBe(true);
    expect([...tx.objectStore('answerLog').indexNames]).toEqual(['by-day']);
    expect([...tx.objectStore('notebook').indexNames]).toEqual(['by-createdAt']);
    expect(tx.objectStore('session').keyPath).toBe('key');
    await tx.done;
  });

  it('keeps data when reopened at the same version', async () => {
    const name = `reopen-${Date.now()}`;
    const a = await openAppDb({ name });
    await commitGrade(a, { progress, counter, log });
    a.close();
    const b = await openAppDb({ name });
    opened.push(b);
    expect((await loadAll(b, day)).progress).toEqual([progress]);
  });
});

describe('loadAll', () => {
  it('returns empty collections and a zero counter for a new DB', async () => {
    const db = await freshDb();
    const data = await loadAll(db, day);
    expect(data).toEqual({ progress: [], flags: [], notebook: [], importedItems: [], counter: { day, newIntroduced: 0, reviewsAnswered: 0 }, session: undefined, meta: [] });
  });
});

describe('commitGrade', () => {
  it('writes progress, counter and log in one go and returns the log id', async () => {
    const db = await freshDb();
    const id = await commitGrade(db, { progress, counter, log });
    expect(id).toBe(1);
    const data = await loadAll(db, day);
    expect(data.progress).toEqual([progress]);
    expect(data.counter).toEqual(counter);
    expect(await db.get('answerLog', id)).toEqual({ ...log, id: 1 });
  });

  it('is atomic: a failing answer-log write leaves progress and counter untouched', async () => {
    const db = await freshDb();
    await commitGrade(db, { progress, counter, log: { ...log, id: 7 } });
    const changed: Progress = { ...progress, box: 3, dueOn: '2026-11-10', updatedAt: 2 };
    // Same explicit log id → ConstraintError on add → the transaction aborts.
    await expect(commitGrade(db, { progress: changed, counter: { ...counter, newIntroduced: 2 }, log: { ...log, id: 7 } })).rejects.toThrow();
    const data = await loadAll(db, day);
    expect(data.progress).toEqual([progress]);
    expect(data.counter).toEqual(counter);
    expect(await db.count('answerLog')).toBe(1);
  });
});

describe('saveSession / clearSession', () => {
  it('stores the single current session and removes it', async () => {
    const db = await freshDb();
    const s = { ...newSession([{ itemId: 'a', kind: 'new' }], day, 1), draft: 'Could you' };
    await saveSession(db, s);
    await saveSession(db, { ...s, draft: 'Could you check' });
    expect((await loadAll(db, day)).session?.draft).toBe('Could you check');
    expect(await db.count('session')).toBe(1);
    await clearSession(db);
    expect((await loadAll(db, day)).session).toBeUndefined();
  });
});
