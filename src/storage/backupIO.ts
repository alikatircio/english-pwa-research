// Export/import IO (07 §3.8): domain/backup.ts builds and validates the files;
// this module only reads and writes IndexedDB.
import { buildFlagsReport, type BackupData, type FlagsReportV1, type ItemsImportPlan } from '../domain/backup.ts';
import type { Item, MetaRecord } from '../domain/types.ts';
import type { AppDb } from './db.ts';
import { writeAll } from './tx.ts';

/** Flags report for review (decision 12): every flag joined with its item. */
export async function exportFlagsReport(
  db: AppDb,
  items: ReadonlyMap<string, Item>,
  contentVersion: string,
  now: number,
): Promise<FlagsReportV1> {
  const flags = await db.getAll('flags');
  return buildFlagsReport(flags.toSorted((a, b) => a.flaggedAt - b.flaggedAt), items, contentVersion, now);
}

/**
 * Items import (T3.4): the accepted items and the notebook entries they
 * convert, in one transaction. Any failure aborts the whole import.
 */
export async function importItems(db: AppDb, plan: Pick<ItemsImportPlan, 'items' | 'notebookUpdates'>): Promise<void> {
  const tx = db.transaction(['importedItems', 'notebook'], 'readwrite');
  await writeAll(tx, (track) => {
    for (const i of plan.items) track(tx.objectStore('importedItems').put(i));
    for (const e of plan.notebookUpdates) track(tx.objectStore('notebook').put(e));
  });
}

// --- Full backup (T5.4) -------------------------------------------------------

/** Stores a full backup carries; the session and meta are never exported (07 §3.8). */
export const BACKUP_STORES = ['progress', 'dailyCounters', 'notebook', 'flags', 'answerLog', 'importedItems'] as const;

/** Everything a full backup holds, read in one transaction. */
export async function readBackupData(db: AppDb): Promise<BackupData> {
  const tx = db.transaction([...BACKUP_STORES, 'diagnosticAttempts'], 'readonly');
  const [progress, dailyCounters, notebook, flags, answerLog, importedItems, diagnosticAttempts] = await Promise.all([
    tx.objectStore('progress').getAll(),
    tx.objectStore('dailyCounters').getAll(),
    tx.objectStore('notebook').index('by-createdAt').getAll(),
    tx.objectStore('flags').getAll(),
    tx.objectStore('answerLog').getAll(),
    tx.objectStore('importedItems').getAll(),
    tx.objectStore('diagnosticAttempts').getAll(),
    tx.done,
  ]);
  const base = { progress, dailyCounters, notebook, flags, answerLog, importedItems };
  return diagnosticAttempts.length > 0 ? { ...base, diagnosticAttempts } : base;
}

export interface RestoreWrite {
  /** The complete new contents of every backup store (merged, or the file's own data). */
  data: BackupData;
  /** Drop the stored round too ("Tümünü değiştir"). */
  clearSession: boolean;
  /** Meta rows written in the same transaction. */
  meta?: readonly MetaRecord[];
}

/**
 * Restore (T5.4): clear every backup store and write `data` in ONE transaction,
 * so a failure anywhere leaves the database exactly as it was. Answer-log rows
 * without an id get a fresh one from the store's autoIncrement.
 */
export async function writeRestore(db: AppDb, { data, clearSession, meta = [] }: RestoreWrite): Promise<void> {
  const tx = db.transaction([...BACKUP_STORES, 'diagnosticAttempts', 'session', 'meta'], 'readwrite');
  // A synchronous throw (e.g. DataError) rolls back everything queued, including the clears.
  await writeAll(tx, (track) => {
    for (const name of BACKUP_STORES) track(tx.objectStore(name).clear());
    track(tx.objectStore('diagnosticAttempts').clear());
    for (const r of data.progress) track(tx.objectStore('progress').put(r));
    for (const r of data.dailyCounters) track(tx.objectStore('dailyCounters').put(r));
    for (const r of data.notebook) track(tx.objectStore('notebook').put(r));
    for (const r of data.flags) track(tx.objectStore('flags').put(r));
    for (const r of data.answerLog) track(tx.objectStore('answerLog').put(r));
    for (const r of data.importedItems) track(tx.objectStore('importedItems').put(r));
    for (const r of data.diagnosticAttempts ?? []) track(tx.objectStore('diagnosticAttempts').put(r));
    if (clearSession) track(tx.objectStore('session').delete('current'));
    for (const r of meta) track(tx.objectStore('meta').put(r));
  });
}
