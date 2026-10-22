import { describe, expect, it } from 'vitest';
import { newSession } from '../domain/session.ts';
import { mayReloadForDb, type AppState, type ReadyState } from './state.ts';

const ready = (patch: Partial<ReadyState>): AppState => ({ status: 'ready', screen: 'home', session: undefined, busy: false, ...patch }) as ReadyState;

describe('mayReloadForDb (review 09 #3)', () => {
  it('reloads only where nothing is interrupted', () => {
    expect(mayReloadForDb({ status: 'loading' })).toBe(true);
    expect(mayReloadForDb(ready({}))).toBe(true);
    const session = newSession([{ itemId: 'a', kind: 'new' }], '2026-11-02', 1);
    expect(mayReloadForDb(ready({ screen: 'card', session }))).toBe(false);
    expect(mayReloadForDb(ready({ session }))).toBe(false); // paused on Home: "Devam et"
    expect(mayReloadForDb(ready({ screen: 'settings' }))).toBe(false);
    expect(mayReloadForDb(ready({ busy: true }))).toBe(false);
  });
});
