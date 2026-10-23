import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it, vi } from 'vitest';
import { createConnection, DB_VERSION, isConnectionLost, openAppDb, type AppDb } from './db.ts';
import { loadCounter, putMeta } from './repo.ts';

let n = 0;
const fresh = () => `conn-${++n}-${Date.now()}`;

describe('reconnecting handle (review 09 #3)', () => {
  it('a closed connection is reopened once and the call goes through', async () => {
    const name = fresh();
    const first = await openAppDb({ name });
    const reopen = vi.fn(() => openAppDb({ name }));
    const conn = createConnection(first, reopen);
    first.close(); // what WebKit's "connection lost" leaves behind
    await conn.run((db) => putMeta(db, [{ key: 'persist', value: true }]));
    expect(reopen).toHaveBeenCalledTimes(1);
    expect(await conn.run((db) => db.get('meta', 'persist'))).toEqual({ key: 'persist', value: true });
    expect(reopen).toHaveBeenCalledTimes(1);
  });

  it('after terminated (markLost) the next call reopens first', async () => {
    const name = fresh();
    const first = await openAppDb({ name });
    const reopen = vi.fn(() => openAppDb({ name }));
    const conn = createConnection(first, reopen);
    conn.markLost();
    const used: AppDb[] = [];
    await conn.run(async (db) => {
      used.push(db);
      return loadCounter(db, '2026-11-02');
    });
    expect(reopen).toHaveBeenCalledTimes(1);
    expect(used[0]).not.toBe(first);
  });

  it('a request error is not a lost connection: no reopen, the error goes to the caller', async () => {
    const name = fresh();
    const first = await openAppDb({ name });
    const reopen = vi.fn(() => openAppDb({ name }));
    const conn = createConnection(first, reopen);
    await conn.run((db) => db.add('notebook', { id: 'x', textTr: 'a', createdAt: 1, status: 'open' }));
    await expect(conn.run((db) => db.add('notebook', { id: 'x', textTr: 'a', createdAt: 1, status: 'open' }))).rejects.toMatchObject({ name: 'ConstraintError' });
    expect(reopen).not.toHaveBeenCalled();
    first.close();
  });

  it('two calls on a lost connection share one reopen', async () => {
    const name = fresh();
    const first = await openAppDb({ name });
    const reopen = vi.fn(() => openAppDb({ name }));
    const conn = createConnection(first, reopen);
    conn.markLost();
    await Promise.all([conn.run((db) => loadCounter(db, '2026-11-02')), conn.run((db) => loadCounter(db, '2026-11-03'))]);
    expect(reopen).toHaveBeenCalledTimes(1);
  });

  it('recognises connection errors only', () => {
    expect(isConnectionLost(new DOMException('closing', 'InvalidStateError'))).toBe(true);
    expect(isConnectionLost(new DOMException('Connection to Indexed Database server lost. Refresh the page to try again', 'UnknownError'))).toBe(true);
    expect(isConnectionLost(new DOMException('key', 'DataError'))).toBe(false);
    expect(isConnectionLost('nope')).toBe(false);
  });
});

describe('blocking (review 09 #3)', () => {
  it('leaves closing to the caller: the newer version waits until close() is called', async () => {
    const name = fresh();
    let close: (() => void) | undefined;
    await openAppDb({ name, onBlocking: (c) => (close = c) });
    let upgraded = false;
    const newer = openDB(name, DB_VERSION + 1, { blocked: () => undefined }).then((db) => {
      upgraded = true;
      return db;
    });
    await vi.waitFor(() => expect(close).toBeDefined());
    await new Promise((r) => setTimeout(r, 20));
    expect(upgraded).toBe(false); // mid-card: the old tab keeps its connection
    close?.();
    (await newer).close();
    expect(upgraded).toBe(true);
  });
});
