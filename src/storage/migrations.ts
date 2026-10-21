// Migrations: ordered `if (oldVersion < N)` blocks, append-only. Never switch,
// never delete a block. Each new version needs a "v(N-1) data → vN keeps data"
// test with fake-indexeddb (07 §3.7).
// Later blocks that touch existing stores take idb's (newVersion, tx) arguments too.
import type { IDBPDatabase } from 'idb';
import type { AppDbSchema } from './db.ts';

export function upgrade(db: IDBPDatabase<AppDbSchema>, oldVersion: number): void {
  if (oldVersion < 1) {
    db.createObjectStore('progress', { keyPath: 'itemId' });
    db.createObjectStore('dailyCounters', { keyPath: 'day' });
    db.createObjectStore('notebook', { keyPath: 'id' }).createIndex('by-createdAt', 'createdAt');
    db.createObjectStore('flags', { keyPath: 'itemId' });
    db.createObjectStore('answerLog', { keyPath: 'id', autoIncrement: true }).createIndex('by-day', 'day');
    db.createObjectStore('importedItems', { keyPath: 'id' });
    db.createObjectStore('session', { keyPath: 'key' });
    db.createObjectStore('meta', { keyPath: 'key' });
  }
}
