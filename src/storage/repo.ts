// Repository: every write is one readwrite transaction (write-through, 07 §3.7).
// Callers update in-memory state only after the returned promise resolves.
import type { AnswerLog, DailyCounter, DayKey, Flag, MetaRecord, NotebookEntry, Progress, SessionState, UndoSnapshot } from '../domain/types.ts';
import type { AppDb, ImportedItem } from './db.ts';

export interface LoadedData {
  progress: Progress[];
  flags: Flag[];
  notebook: NotebookEntry[];
  importedItems: ImportedItem[];
  /** Counter for `today`; zeroes if none stored. */
  counter: DailyCounter;
  session: SessionState | undefined;
  meta: MetaRecord[];
}

export function emptyCounter(day: DayKey): DailyCounter {
  return { day, newIntroduced: 0, reviewsAnswered: 0 };
}

/** Everything the app keeps in memory, read in one transaction at boot. */
export async function loadAll(db: AppDb, today: DayKey): Promise<LoadedData> {
  const tx = db.transaction(['progress', 'flags', 'notebook', 'importedItems', 'dailyCounters', 'session', 'meta'], 'readonly');
  const [progress, flags, notebook, importedItems, counter, session, meta] = await Promise.all([
    tx.objectStore('progress').getAll(),
    tx.objectStore('flags').getAll(),
    tx.objectStore('notebook').index('by-createdAt').getAll(),
    tx.objectStore('importedItems').getAll(),
    tx.objectStore('dailyCounters').get(today),
    tx.objectStore('session').get('current'),
    tx.objectStore('meta').getAll(),
    tx.done,
  ]);
  return { progress, flags, notebook, importedItems, counter: counter ?? emptyCounter(today), session, meta };
}

export interface GradeCommit {
  progress: Progress;
  counter: DailyCounter;
  log: AnswerLog;
  /** Session after the grade; omitted → session store untouched. */
  session?: SessionState;
  /** Stored as `session.undo` with the new log id filled in (decision 10, T2.4). Needs `session`. */
  undo?: Omit<UndoSnapshot, 'logId'>;
}

/**
 * Atomic grade write: progress + daily counter + answer log (+ session).
 * If any request fails the whole transaction aborts and nothing changes.
 * Resolves with the new answer-log id.
 */
export async function commitGrade(db: AppDb, c: GradeCommit): Promise<number> {
  const tx = db.transaction(['progress', 'dailyCounters', 'answerLog', 'session'], 'readwrite');
  const writes: Promise<unknown>[] = [
    tx.objectStore('progress').put(c.progress),
    tx.objectStore('dailyCounters').put(c.counter),
  ];
  const logId = tx.objectStore('answerLog').add(c.log);
  const { session, undo } = c;
  if (session && undo) {
    // Same transaction: the session write waits for the log id it points at.
    writes.push(logId.then((id) => tx.objectStore('session').put({ ...session, undo: { ...undo, logId: id } })));
  } else if (session) {
    writes.push(tx.objectStore('session').put(session));
  }
  const [id] = await Promise.all([logId, ...writes, tx.done]);
  return id;
}

/**
 * Undo a grade (decision 10): restore or delete progress, restore the counter,
 * delete the answer-log row and store the session, in one transaction.
 */
export async function undoGrade(db: AppDb, undo: UndoSnapshot, session: SessionState): Promise<void> {
  const tx = db.transaction(['progress', 'dailyCounters', 'answerLog', 'session'], 'readwrite');
  const progress = tx.objectStore('progress');
  await Promise.all([
    undo.prevProgress ? progress.put(undo.prevProgress) : progress.delete(undo.itemId),
    tx.objectStore('dailyCounters').put(undo.prevCounter),
    tx.objectStore('answerLog').delete(undo.logId),
    tx.objectStore('session').put(session),
    tx.done,
  ]);
}

/**
 * Decision 12: one flag per item; pressing again removes it. Read and write in
 * one transaction. Resolves with whether the item is flagged afterwards.
 */
export async function toggleFlag(db: AppDb, flag: Flag): Promise<boolean> {
  const tx = db.transaction('flags', 'readwrite');
  const store = tx.objectStore('flags');
  const existing = await store.get(flag.itemId);
  if (existing) await store.delete(flag.itemId);
  else await store.put(flag);
  await tx.done;
  return !existing;
}

/** Session only (draft, cursor, phase). Debounced by the caller (~300 ms). */
export async function saveSession(db: AppDb, session: SessionState): Promise<void> {
  await db.put('session', session);
}

export async function clearSession(db: AppDb): Promise<void> {
  await db.delete('session', 'current');
}
