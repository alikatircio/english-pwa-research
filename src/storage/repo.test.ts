import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { AnswerLog, DailyCounter, DiagnosticAttempt, Progress } from '../domain/types.ts';
import type { StoreNames } from 'idb';
import { DB_VERSION, openAppDb, type AppDb, type AppDbSchema } from './db.ts';

const STORES: StoreNames<AppDbSchema>[] = ['answerLog', 'dailyCounters', 'diagnosticAttempts', 'flags', 'importedItems', 'meta', 'notebook', 'progress', 'session'];
import { addNotebookEntry, clearSession, commitGrade, loadAll, loadCounter, loadDiagnosticAttempts, loadInProgressAttempt, saveDiagnosticAttempt, saveSession, toggleFlag, undoGrade } from './repo.ts';
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
  it('creates all 9 stores with their keys and indexes', async () => {
    const db = await freshDb();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(STORES);
    const tx = db.transaction(STORES, 'readonly');
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

  it('is atomic on a synchronous throw: a progress without a key writes no counter (review 09 #4)', async () => {
    const db = await freshDb();
    // No itemId → put() throws DataError synchronously, after the counter put was queued.
    const keyless = { ...progress, itemId: undefined } as unknown as Progress;
    await expect(commitGrade(db, { progress: keyless, counter, log })).rejects.toThrow();
    const data = await loadAll(db, day);
    expect(data.counter).toEqual({ day, newIntroduced: 0, reviewsAnswered: 0 });
    expect(data.progress).toEqual([]);
    expect(await db.count('answerLog')).toBe(0);
  });

  it('is atomic when the session write after the log id throws: nothing is kept', async () => {
    const db = await freshDb();
    const session = newSession([{ itemId: 'a', kind: 'new' }], day, 1);
    // A function is not cloneable → DataCloneError inside the log-id callback.
    const undo = { itemId: 'a', prevProgress: null, prevCounter: counter, prevRound: { queue: [], repeatQueued: [], consecutiveWrong: 0, studiedChunks: [] }, expiresAt: () => 5 } as unknown as Parameters<typeof commitGrade>[1]['undo'];
    await expect(commitGrade(db, { progress, counter, log, session, ...(undo ? { undo } : {}) })).rejects.toThrow();
    const data = await loadAll(db, day);
    expect(data.progress).toEqual([]);
    expect(data.counter).toEqual({ day, newIntroduced: 0, reviewsAnswered: 0 });
    expect(await db.count('answerLog')).toBe(0);
    expect(data.session).toBeUndefined();
  });

  it('a repeat answer (no progress) writes the log and counter but leaves progress alone (decision 5)', async () => {
    const db = await freshDb();
    await commitGrade(db, { progress, counter, log });
    await commitGrade(db, { counter, log: { ...log, isRepeat: true, boxBefore: 2, boxAfter: 2 } });
    expect((await loadAll(db, day)).progress).toEqual([progress]);
    expect(await db.count('answerLog')).toBe(2);
  });
});

describe('loadCounter', () => {
  it('returns the stored counter of a day, or zeroes', async () => {
    const db = await freshDb();
    await commitGrade(db, { progress, counter, log });
    expect(await loadCounter(db, day)).toEqual(counter);
    expect(await loadCounter(db, '2026-11-03')).toEqual({ day: '2026-11-03', newIntroduced: 0, reviewsAnswered: 0 });
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

describe('undoGrade (T2.4)', () => {
  const session = newSession([{ itemId: 'a', kind: 'new' }], day, 1);
  const zero: DailyCounter = { day, newIntroduced: 0, reviewsAnswered: 0 };
  const prevRound = { queue: session.queue, repeatQueued: [], consecutiveWrong: 0, studiedChunks: [] };

  it('commitGrade stores the undo snapshot in the session with the new log id', async () => {
    const db = await freshDb();
    await commitGrade(db, { progress, counter, log: { ...log, id: 41 }, session, undo: { itemId: 'a', prevProgress: null, prevCounter: zero, prevRound, expiresAt: 5 } });
    expect((await loadAll(db, day)).session?.undo).toEqual({ itemId: 'a', prevProgress: null, prevCounter: zero, prevRound, expiresAt: 5, logId: 41 });
  });

  it('restores a new card: progress deleted, counter back, log row removed, session written', async () => {
    const db = await freshDb();
    const id = await commitGrade(db, { progress, counter, log, session });
    const restored = { ...session, draft: 'back' };
    await undoGrade(db, { itemId: 'a', prevProgress: null, prevCounter: zero, prevRound, logId: id, expiresAt: 5 }, restored);
    const data = await loadAll(db, day);
    expect(data.progress).toEqual([]);
    expect(data.counter).toEqual(zero);
    expect(await db.count('answerLog')).toBe(0);
    expect(data.session).toEqual(restored);
  });

  it('is atomic on a synchronous throw: a keyless counter leaves the graded progress and log in place (review 09 #4)', async () => {
    const db = await freshDb();
    const id = await commitGrade(db, { progress, counter, log, session });
    const keyless = { newIntroduced: 0, reviewsAnswered: 0 } as unknown as DailyCounter;
    await expect(undoGrade(db, { itemId: 'a', prevProgress: null, prevCounter: keyless, prevRound, logId: id, expiresAt: 5 }, session)).rejects.toThrow();
    const data = await loadAll(db, day);
    expect(data.progress).toEqual([progress]);
    expect(data.counter).toEqual(counter);
    expect(await db.count('answerLog')).toBe(1);
  });

  it('restores the previous progress of a reviewed card and keeps other log rows', async () => {
    const db = await freshDb();
    const first = await commitGrade(db, { progress, counter, log });
    const changed: Progress = { ...progress, box: 1, dueOn: '2026-11-03', lastGrade: 'wrong', updatedAt: 2 };
    const second = await commitGrade(db, { progress: changed, counter: { ...counter, reviewsAnswered: 1 }, log: { ...log, grade: 'wrong' } });
    await undoGrade(db, { itemId: 'a', prevProgress: progress, prevCounter: counter, prevRound, logId: second, expiresAt: 5 }, session);
    const data = await loadAll(db, day);
    expect(data.progress).toEqual([progress]);
    expect(data.counter).toEqual(counter);
    expect(await db.getAllKeys('answerLog')).toEqual([first]);
  });
});

describe('toggleFlag (T2.5)', () => {
  it('adds the flag, then removes it on the second press', async () => {
    const db = await freshDb();
    const flag = { itemId: 'a', flaggedAt: 1, screen: 'question' as const, contentVersion: 'v1' };
    expect(await toggleFlag(db, flag)).toBe(true);
    expect((await loadAll(db, day)).flags).toEqual([flag]);
    expect(await toggleFlag(db, { ...flag, flaggedAt: 2 })).toBe(false);
    expect((await loadAll(db, day)).flags).toEqual([]);
  });
});

describe('notebook', () => {
  it('addNotebookEntry stores the entry; loadAll returns entries oldest first', async () => {
    const db = await freshDb();
    await addNotebookEntry(db, { id: 'b', textTr: 'ikinci', createdAt: 2, status: 'open' });
    await addNotebookEntry(db, { id: 'a', textTr: 'birinci', contextTr: 'durum', contextItemId: 'x', createdAt: 1, status: 'open' });
    const data = await loadAll(db, day);
    expect(data.notebook.map((e) => e.id)).toEqual(['a', 'b']);
    expect(data.notebook[0]?.contextTr).toBe('durum');
  });

  it('refuses a second entry with the same id (nothing overwritten)', async () => {
    const db = await freshDb();
    await addNotebookEntry(db, { id: 'a', textTr: 'birinci', createdAt: 1, status: 'open' });
    await expect(addNotebookEntry(db, { id: 'a', textTr: 'başka', createdAt: 2, status: 'open' })).rejects.toThrow();
    expect((await db.get('notebook', 'a'))?.textTr).toBe('birinci');
  });
});

describe('diagnostic attempts (v2)', () => {
  const attempt = (id: string, startedAt: number, finishedAt?: number): DiagnosticAttempt => ({
    id,
    startedAt,
    ...(finishedAt === undefined ? {} : { finishedAt }),
    extrasVersion: 'x1',
    order: ['q1', 'q2'],
    cursor: 1,
    answers: { q1: { chosen: ['a'], unsure: false } },
  });

  it('saves, replaces by id and loads sorted by startedAt', async () => {
    const db = await freshDb();
    await saveDiagnosticAttempt(db, attempt('b', 20, 30));
    await saveDiagnosticAttempt(db, attempt('a', 10, 15));
    await saveDiagnosticAttempt(db, { ...attempt('b', 20, 30), cursor: 2 });
    const all = await loadDiagnosticAttempts(db);
    expect(all.map((a) => a.id)).toEqual(['a', 'b']);
    expect(all[1]?.cursor).toBe(2);
  });

  it('loadInProgressAttempt returns the unfinished attempt, or undefined', async () => {
    const db = await freshDb();
    expect(await loadInProgressAttempt(db)).toBeUndefined();
    await saveDiagnosticAttempt(db, attempt('done', 10, 15));
    expect(await loadInProgressAttempt(db)).toBeUndefined();
    await saveDiagnosticAttempt(db, attempt('open', 20));
    expect((await loadInProgressAttempt(db))?.id).toBe('open');
    await saveDiagnosticAttempt(db, attempt('open', 20, 25));
    expect(await loadInProgressAttempt(db)).toBeUndefined();
  });
});
