// Repository: every write is one readwrite transaction (write-through, 07 §3.7).
// Callers update in-memory state only after the returned promise resolves.
import type { AnswerLog, DailyCounter, DayKey, Flag, MetaRecord, NotebookEntry, Progress, SessionState } from '../domain/types.ts';
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
  if (c.session) writes.push(tx.objectStore('session').put(c.session));
  const logId = tx.objectStore('answerLog').add(c.log);
  const [id] = await Promise.all([logId, ...writes, tx.done]);
  return id;
}
