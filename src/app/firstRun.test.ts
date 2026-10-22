import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../content/fixtures/e2e-items.json';
import { fixedClock } from '../domain/clock.ts';
import type { ContentBundle, MetaRecord, Progress } from '../domain/types.ts';
import { openAppDb } from '../storage/db.ts';
import { createActions } from './actions.ts';
import { boot } from './boot.ts';
import { metaFromRecords } from './meta.ts';
import type { ReadyState } from './state.ts';
import { createStore } from './store.ts';

const bundle = fixture as ContentBundle;
const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date(2026, 10, 20, 8).getTime();

afterEach(() => {
  vi.unstubAllGlobals();
});

let n = 0;
async function setup({ meta = [] as MetaRecord[], progress = [] as Progress[] } = {}) {
  const name = `first-run-${++n}-${Date.now()}`;
  const seed = await openAppDb({ name });
  for (const m of meta) await seed.put('meta', m);
  for (const p of progress) await seed.put('progress', p);
  seed.close();
  const clock = fixedClock(T0);
  const { db, state } = await boot({ bundle, clock, openDb: () => openAppDb({ name }) });
  const store = createStore();
  store.dispatch({ type: 'booted', state });
  const actions = createActions({ db, clock, getState: store.getState, dispatch: store.dispatch });
  const ready = () => store.getState() as ReadyState;
  /** Let fire-and-forget meta writes settle. */
  const settle = () => new Promise((r) => setTimeout(r, 20));
  return { db, clock, actions, ready, settle };
}

const prog = (introducedOn: string): Progress => ({
  itemId: bundle.items[0]?.id ?? '', box: 2, dueOn: '2026-12-01', introducedOn, lastAnsweredOn: introducedOn, lastGrade: 'correct', updatedAt: 1,
});

describe('metaFromRecords', () => {
  it('reads typed values and ignores rows of the wrong type', () => {
    expect(
      metaFromRecords([
        { key: 'firstRunAt', value: 5 },
        { key: 'persist', value: true },
        { key: 'installHintDismissed', value: 'yes' },
        { key: 'lastExportAt', value: Number.NaN },
      ]),
    ).toEqual({ firstRunAt: 5, persist: true, installHintDismissed: undefined, lastExportAt: undefined, backupReminderDismissedAt: undefined });
  });
});

describe('first "Başla" (T5.5)', () => {
  it('asks for persistent storage once and stores firstRunAt and the result', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal('navigator', { storage: { persist } });
    const app = await setup();
    expect(app.ready().meta.firstRunAt).toBeUndefined();

    app.actions.beginFirstRun();
    expect(persist).toHaveBeenCalledTimes(1); // synchronously, inside the tap
    expect(app.ready().meta.firstRunAt).toBe(T0);
    await app.settle();
    expect(await app.db.get('meta', 'firstRunAt')).toEqual({ key: 'firstRunAt', value: T0 });
    expect(await app.db.get('meta', 'persist')).toEqual({ key: 'persist', value: true });
    expect(app.ready().meta.persist).toBe(true);

    app.actions.beginFirstRun();
    expect(persist).toHaveBeenCalledTimes(1);
    app.db.close();
  });

  it('without the Storage API (or on a rejection) persist is stored as off', async () => {
    vi.stubGlobal('navigator', {});
    const app = await setup();
    expect(await app.actions.requestPersist()).toBe(false);
    expect(app.ready().meta.persist).toBe(false);

    vi.stubGlobal('navigator', { storage: { persist: () => Promise.reject(new Error('nope')) } });
    expect(await app.actions.requestPersist()).toBe(false);
    expect(await app.db.get('meta', 'persist')).toEqual({ key: 'persist', value: false });
    app.db.close();
  });
});

describe('hints (T5.5)', () => {
  it('the install hint dismissal is stored', async () => {
    const app = await setup();
    await app.actions.dismissInstallHint();
    expect(app.ready().meta.installHintDismissed).toBe(true);
    expect(await app.db.get('meta', 'installHintDismissed')).toEqual({ key: 'installHintDismissed', value: true });
    app.db.close();
  });

  it('backup reminder: due a week after the first answer with no export; "Kapat" hides it for a week', async () => {
    const app = await setup({ progress: [prog('2026-11-10')] });
    expect(app.actions.isBackupReminderDue()).toBe(true);
    await app.actions.dismissBackupReminder();
    expect(app.actions.isBackupReminderDue()).toBe(false);
    app.clock.advance(7 * DAY);
    expect(app.actions.isBackupReminderDue()).toBe(true);
    await app.actions.markBackupExported();
    expect(app.actions.isBackupReminderDue()).toBe(false);
    app.db.close();
  });

  it('a recent export (from meta) means no reminder', async () => {
    const app = await setup({ progress: [prog('2026-10-01')], meta: [{ key: 'lastExportAt', value: T0 - 2 * DAY }] });
    expect(app.actions.isBackupReminderDue()).toBe(false);
    app.db.close();
  });
});
