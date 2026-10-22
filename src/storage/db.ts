// IndexedDB schema v1 (07 §3.7). Every store exists from v1 so later slices
// need no migration just to add a store.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AnswerLog,
  DailyCounter,
  DayKey,
  Flag,
  ImportedItem,
  MetaRecord,
  NotebookEntry,
  Progress,
  SessionState,
} from '../domain/types.ts';
import { upgrade } from './migrations.ts';

export const DB_NAME = 'english-pwa';
export const DB_VERSION = 1;

export type { ImportedItem } from '../domain/types.ts';

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

export interface OpenOptions {
  name?: string;
  /**
   * Another tab wants a newer DB version and waits for this connection to close.
   * `close` closes it; the caller decides when (never mid-card, 07 §6.2). Without
   * this option the connection is closed at once.
   */
  onBlocking?: (close: () => void) => void;
  /** The browser closed the connection abnormally (e.g. iOS "connection lost"). */
  onTerminated?: () => void;
}

export async function openAppDb({ name = DB_NAME, onBlocking, onTerminated }: OpenOptions = {}): Promise<AppDb> {
  const db = await openDB<AppDbSchema>(name, DB_VERSION, {
    upgrade,
    blocking() {
      if (onBlocking) onBlocking(() => db.close());
      else db.close();
    },
    terminated() {
      onTerminated?.();
    },
  });
  return db;
}

// --- Reconnecting handle (review 09 #3) ---------------------------------------

/**
 * Errors that mean the connection itself is gone, not that the request was
 * wrong: a closed/closing connection (InvalidStateError from transaction()),
 * or WebKit's "Connection to Indexed Database server lost" (UnknownError).
 */
export function isConnectionLost(e: unknown): boolean {
  if (!(e instanceof Error) && !(typeof e === 'object' && e !== null && 'name' in e)) return false;
  const { name, message } = e as { name?: unknown; message?: unknown };
  if (name === 'InvalidStateError' || name === 'UnknownError') return true;
  return typeof message === 'string' && /connection .*lost/i.test(message);
}

export interface DbConnection {
  /**
   * Run `fn` with the live connection. If the connection was lost (terminated,
   * or `fn` fails with a connection error), reopen once and run `fn` again. A
   * failed transaction wrote nothing, so the retry cannot double-write.
   */
  run<T>(fn: (db: AppDb) => Promise<T>): Promise<T>;
  /** The connection was terminated: reopen before the next run. */
  markLost(): void;
}

export function createConnection(first: AppDb, reopen: () => Promise<AppDb>): DbConnection {
  let current = first;
  let lost = false;
  let reopening: Promise<AppDb> | undefined;

  function reconnect(): Promise<AppDb> {
    reopening ??= (async () => {
      try {
        current.close();
      } catch {
        // Already closed.
      }
      try {
        current = await reopen();
        lost = false;
        return current;
      } finally {
        reopening = undefined;
      }
    })();
    return reopening;
  }

  return {
    async run(fn) {
      const db = lost || reopening ? await reconnect() : current;
      try {
        return await fn(db);
      } catch (e) {
        if (!isConnectionLost(e)) throw e;
        return fn(await reconnect());
      }
    },
    markLost() {
      lost = true;
    },
  };
}

/** A handle that never reconnects (tests, one-off scripts). */
export function fixedConnection(db: AppDb): DbConnection {
  return { run: (fn) => fn(db), markLost: () => undefined };
}
