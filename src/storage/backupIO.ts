// Export/import IO (07 §3.8): domain/backup.ts builds and validates the files;
// this module only reads and writes IndexedDB.
import { buildFlagsReport, type FlagsReportV1, type ItemsImportPlan } from '../domain/backup.ts';
import type { Item } from '../domain/types.ts';
import type { AppDb } from './db.ts';

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
  const requests: Promise<unknown>[] = [];
  try {
    for (const i of plan.items) requests.push(tx.objectStore('importedItems').put(i));
    for (const e of plan.notebookUpdates) requests.push(tx.objectStore('notebook').put(e));
  } catch (e) {
    // A request threw synchronously (e.g. DataError): roll back the puts already queued.
    for (const r of requests) r.catch(() => undefined);
    tx.abort();
    await tx.done.catch(() => undefined);
    throw e;
  }
  await Promise.all([...requests, tx.done]);
}
