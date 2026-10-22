// Export/import IO (07 §3.8): domain/backup.ts builds and validates the files;
// this module only reads and writes IndexedDB.
import { buildFlagsReport, type FlagsReportV1 } from '../domain/backup.ts';
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
