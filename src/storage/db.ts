// IndexedDB schema v1 (07 §3.7). Every store exists from v1 so later slices
// need no migration just to add a store.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AnswerLog,
  DailyCounter,
  DayKey,
  Flag,
  Item,
  MetaRecord,
  NotebookEntry,
  Progress,
  SessionState,
} from '../domain/types.ts';
import { upgrade } from './migrations.ts';

export const DB_NAME = 'english-pwa';
export const DB_VERSION = 1;

export type ImportedItem = Item & { importedAt: number };

export interface AppDbSchema extends DBSchema {
  progress: { key: string; value: Progress };
  dailyCounters: { key: DayKey; value: DailyCounter };
  notebook: { key: string; value: NotebookEntry; indexes: { 'by-createdAt': number } };
  flags: { key: string; value: Flag };
  answerLog: { key: number; value: AnswerLog; indexes: { 'by-day': DayKey } };
  importedItems: { key: string; value: ImportedItem };
  session: { key: 'current'; value: SessionState };
  meta: { key: MetaRecord['key']; value: MetaRecord };
}

export type AppDb = IDBPDatabase<AppDbSchema>;

export const STORE_NAMES = [
  'progress',
  'dailyCounters',
  'notebook',
  'flags',
  'answerLog',
  'importedItems',
  'session',
  'meta',
] as const;

export interface OpenOptions {
  name?: string;
  /** Another tab/SW wants a newer version: close and let the caller reload. */
  onBlocking?: () => void;
}

export async function openAppDb({ name = DB_NAME, onBlocking }: OpenOptions = {}): Promise<AppDb> {
  const db = await openDB<AppDbSchema>(name, DB_VERSION, {
    upgrade,
    blocking() {
      db.close();
      onBlocking?.();
    },
  });
  return db;
}
