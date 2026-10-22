// Repository: every write is one readwrite transaction (write-through, 07 §3.7).
// Callers update in-memory state only after the returned promise resolves.
import type { AnswerLog, DailyCounter, DayKey, Flag, MetaRecord, NotebookEntry, Progress, SessionState, UndoSnapshot } from '../domain/types.ts';
import type { AppDb, ImportedItem } from './db.ts';
import { writeAll } from './tx.ts';
import { emptyCounter } from '../domain/session.ts';

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
  /** Omitted for an end-of-round repeat: it never changes the box (decision 5). */
  progress?: Progress;
  /** Counter of the day the round was built (03 §4.5). Omitted for free practice: no counter changes (decision 30). */
  counter?: DailyCounter;
  log: AnswerLog;
  /** Session after the grade; omitted → session store untouched. */
  session?: SessionState;
  /** Stored as `session.undo` with the new log id filled in (decision 10, T2.4). Needs `session`. */
  undo?: Omit<UndoSnapshot, 'logId'>;
}

/** Stored counter of `day`, zeroes if none. */
export async function loadCounter(db: AppDb, day: DayKey): Promise<DailyCounter> {
  return (await db.get('dailyCounters', day)) ?? emptyCounter(day);
}

/**
 * Atomic grade write: progress + daily counter + answer log (+ session).
 * If any request fails, synchronously or not, the whole transaction aborts and
 * nothing changes (writeAll). Resolves with the new answer-log id.
 */
export async function commitGrade(db: AppDb, c: GradeCommit): Promise<number> {
  const tx = db.transaction(['progress', 'dailyCounters', 'answerLog', 'session'], 'readwrite');
  let logId: Promise<number> | undefined;
  await writeAll(tx, (track) => {
    if (c.counter) track(tx.objectStore('dailyCounters').put(c.counter));
    if (c.progress) track(tx.objectStore('progress').put(c.progress));
    const added = track(tx.objectStore('answerLog').add(c.log));
    logId = added;
    const { session, undo } = c;
    if (session && undo) {
      // Same transaction: the session write waits for the log id it points at.
      track(added.then((id) => tx.objectStore('session').put({ ...session, undo: { ...undo, logId: id } })));
    } else if (session) {
      track(tx.objectStore('session').put(session));
    }
  });
  // writeAll resolved, so the add was queued and succeeded.
  return (await logId) as number;
}

/**
 * Undo a grade (decision 10): restore or delete progress, restore the counter,
 * delete the answer-log row and store the session, in one transaction (all or nothing).
 */
export async function undoGrade(db: AppDb, undo: UndoSnapshot, session: SessionState): Promise<void> {
  const tx = db.transaction(['progress', 'dailyCounters', 'answerLog', 'session'], 'readwrite');
  const progress = tx.objectStore('progress');
  await writeAll(tx, (track) => {
    track<unknown>(undo.prevProgress ? progress.put(undo.prevProgress) : progress.delete(undo.itemId));
    track(tx.objectStore('dailyCounters').put(undo.prevCounter));
    track(tx.objectStore('answerLog').delete(undo.logId));
    track(tx.objectStore('session').put(session));
  });
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

/** Meta rows (last export, persist result, dismissed hints…), one transaction. */
export async function putMeta(db: AppDb, records: readonly MetaRecord[]): Promise<void> {
  const tx = db.transaction('meta', 'readwrite');
  await Promise.all([...records.map((r) => tx.store.put(r)), tx.done]);
}

/** One notebook entry (Slice 3, T3.1). Works offline: IndexedDB only. */
export async function addNotebookEntry(db: AppDb, entry: NotebookEntry): Promise<void> {
  await db.add('notebook', entry);
}
