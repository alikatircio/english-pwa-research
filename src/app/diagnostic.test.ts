import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import fixture from '../../content/fixtures/e2e-items.json';
import { AREAS } from '../domain/areas.ts';
import { fixedClock } from '../domain/clock.ts';
import type { DiagnosticQuestion } from '../domain/extrasSchema.ts';
import type { ContentBundle } from '../domain/types.ts';
import { openAppDb } from '../storage/db.ts';
import { loadDiagnosticAttempts } from '../storage/repo.ts';
import { createActions } from './actions.ts';
import { boot } from './boot.ts';
import { createStore } from './store.ts';

const bundle = fixture as ContentBundle;
const questions: DiagnosticQuestion[] = AREAS.flatMap((a) =>
  [1, 2, 3].map((n) => ({
    id: `dq-${a.id}-${n}`, area: a.id, category: 'grammar', refs: [], relatedItemIds: [], promptTr: 'p', stem: 's',
    options: (['a', 'b', 'c', 'd'] as const).map((id) => ({ id, text: id })), correct: ['a'], explanationTr: 'e', verified: true, verifiedNote: 'n',
  })),
) as DiagnosticQuestion[];

let n = 0;
async function setup(diagnostic: DiagnosticQuestion[] = questions, name = `diag-${++n}-${Date.now()}`) {
  const clock = fixedClock(new Date(2026, 10, 2, 8).getTime());
  const { db, state } = await boot({ bundle, clock, openDb: () => openAppDb({ name }) });
  const store = createStore();
  store.dispatch({ type: 'booted', state });
  const actions = createActions({ db, clock, getState: store.getState, dispatch: store.dispatch, extras: { extrasVersion: 'v1', diagnostic } });
  const ready = () => {
    const s = store.getState();
    if (s.status !== 'ready') throw new Error('not ready');
    return s;
  };
  return { db, name, clock, actions, ready, store };
}

describe('diagnostic actions', () => {
  it('is unavailable and does nothing with an empty bundle', async () => {
    const app = await setup([]);
    expect(app.actions.diagnosticAvailable()).toBe(false);
    await app.actions.openDiagnostic();
    expect(app.ready().diagnostic?.open).toBeUndefined();
    expect(await loadDiagnosticAttempts(app.db)).toEqual([]);
  });

  it('persists every answer, resumes after reload, finishes with frozen results', async () => {
    const app = await setup();
    await app.actions.openDiagnostic();
    const open = app.ready().diagnostic?.open;
    expect(open?.order).toHaveLength(48);
    const first = open?.order[0] ?? '';
    await app.actions.answerDiagnostic(first, ['a']);
    await app.actions.moveDiagnostic('next');
    const second = app.ready().diagnostic?.open?.order[1] ?? '';
    await app.actions.answerDiagnostic(second, 'unsure');
    expect((await loadDiagnosticAttempts(app.db))[0]).toMatchObject({ cursor: 1, answers: { [first]: { chosen: ['a'], unsure: false }, [second]: { chosen: [], unsure: true } } });

    // reload: a second boot on the same db resumes at the same place with the same order
    app.db.close();
    const re = await setup(questions, app.name);
    expect(re.ready().diagnostic?.open).toMatchObject({ id: open?.id, order: open?.order, cursor: 1 });
    await re.actions.openDiagnostic(); // resume, not a second attempt
    expect(re.ready().diagnostic?.attempts).toHaveLength(1);

    app.clock.advance(1000);
    await re.actions.finishDiagnostic();
    const done = re.ready().diagnostic;
    expect(done?.open).toBeUndefined();
    expect(done?.attempts[0]?.finishedAt).toBeDefined();
    expect(Object.keys(done?.attempts[0]?.areaResults ?? {})).toHaveLength(16);
    expect((await loadDiagnosticAttempts(re.db))[0]?.areaResults).toEqual(done?.attempts[0]?.areaResults);
  });

  it('replaces an open attempt whose questions left the bundle', async () => {
    const app = await setup();
    await app.actions.openDiagnostic();
    const stale = app.ready().diagnostic?.open;
    app.db.close();
    const renamed = questions.map((q) => ({ ...q, id: `${q.id}-v2` }));
    const re = await setup(renamed, app.name);
    await re.actions.openDiagnostic();
    const open = re.ready().diagnostic?.open;
    expect(open?.id).toBe(stale?.id);
    expect(open?.order.every((id) => id.endsWith('-v2'))).toBe(true);
    expect(await loadDiagnosticAttempts(re.db)).toHaveLength(1);
  });

  it('never touches progress, counters or the answer log', async () => {
    const app = await setup();
    const before = app.ready();
    const counts = async () => ({
      progress: await app.db.getAll('progress'), counters: await app.db.getAll('dailyCounters'), log: await app.db.getAll('answerLog'),
    });
    const snap = await counts();
    await app.actions.openDiagnostic();
    for (const id of app.ready().diagnostic?.open?.order ?? []) {
      await app.actions.answerDiagnostic(id, ['a']);
      await app.actions.moveDiagnostic('next');
    }
    await app.actions.finishDiagnostic();
    const after = app.ready();
    expect(await counts()).toEqual(snap);
    expect(after.progress).toBe(before.progress);
    expect(after.counter).toBe(before.counter);
    expect(after.session).toBe(before.session);
  });
});
