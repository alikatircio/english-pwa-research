import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import fixture from '../../content/fixtures/e2e-items.json';
import { fixedClock } from '../domain/clock.ts';
import type { ContentBundle, Grade, Progress } from '../domain/types.ts';
import { openAppDb } from '../storage/db.ts';
import { createActions } from './actions.ts';
import { boot } from './boot.ts';
import type { ReadyState } from './state.ts';
import { createStore } from './store.ts';

const bundle = fixture as ContentBundle;
const ids = bundle.items.map((i) => i.id);
const canonical = (id: string) => bundle.items.find((i) => i.id === id)?.acceptedAnswers[0] ?? '';
const T0 = new Date(2026, 10, 2, 8).getTime();

let n = 0;
async function setup({ progress = [] as Progress[], at = T0 } = {}) {
  const name = `actions-${++n}-${Date.now()}`;
  const seed = await openAppDb({ name });
  for (const p of progress) await seed.put('progress', p);
  seed.close();
  const clock = fixedClock(at);
  const { db, state } = await boot({ bundle, clock, openDb: () => openAppDb({ name }) });
  const store = createStore();
  store.dispatch({ type: 'booted', state });
  const actions = createActions({ db, clock, getState: store.getState, dispatch: store.dispatch });
  const ready = (): ReadyState => {
    const s = store.getState();
    if (s.status !== 'ready') throw new Error('not ready');
    return s;
  };
  const current = () => {
    const s = ready().session;
    return s?.queue[s.cursor];
  };
  /** Answer the current card: canonical → auto-correct, otherwise self-graded. */
  async function answer(g: Grade) {
    const entry = current();
    if (!entry) throw new Error('no card');
    if (g === 'correct') await actions.submitAnswer(canonical(entry.itemId));
    else {
      await actions.submitAnswer('something else entirely');
      await actions.selfGrade(g);
    }
  }
  return { db, clock, actions, ready, current, answer };
}

const due = (itemId: string, box: Progress['box'], dueOn = '2026-11-02'): Progress => ({
  itemId, box, dueOn, introducedOn: '2026-10-20', lastAnsweredOn: '2026-10-25', lastGrade: 'correct', updatedAt: 1,
});

describe('actions — round wiring (T4.4)', () => {
  it('a new card first answer counts newIntroduced, a due card counts reviewsAnswered, in the grade transaction', async () => {
    const app = await setup({ progress: [due(ids[0] ?? '', 2)] });
    expect(app.ready().session?.queue.map((e) => e.kind)).toEqual(['due', 'new', 'new', 'new', 'new', 'new']);

    await app.answer('correct');
    expect(await app.db.get('dailyCounters', '2026-11-02')).toEqual({ day: '2026-11-02', newIntroduced: 0, reviewsAnswered: 1 });
    expect((await app.db.get('progress', ids[0] ?? ''))?.box).toBe(3);
    app.actions.next();
    await app.answer('partial');
    expect(await app.db.get('dailyCounters', '2026-11-02')).toEqual({ day: '2026-11-02', newIntroduced: 1, reviewsAnswered: 1 });
    expect(app.ready().counter).toEqual({ day: '2026-11-02', newIntroduced: 1, reviewsAnswered: 1 });
    app.db.close();
  });

  it('a wrong first answer queues one repeat; the repeat answer writes a log row only (decision 5)', async () => {
    const app = await setup();
    const first = ids[0] ?? '';
    await app.answer('wrong');
    expect(app.ready().session?.queue.at(-1)).toEqual({ itemId: first, kind: 'repeat' });
    const afterFirst = await app.db.get('progress', first);
    expect(afterFirst?.box).toBe(1);

    for (let i = 1; i < 5; i++) {
      app.actions.next();
      await app.answer('correct');
    }
    app.actions.next();
    expect(app.current()).toEqual({ itemId: first, kind: 'repeat' });
    app.clock.advance(60_000);
    await app.answer('correct');

    expect(await app.db.get('progress', first)).toEqual(afterFirst); // box, dueOn, updatedAt unchanged
    expect(await app.db.get('dailyCounters', '2026-11-02')).toEqual({ day: '2026-11-02', newIntroduced: 5, reviewsAnswered: 0 });
    const logs = await app.db.getAll('answerLog');
    expect(logs.at(-1)).toMatchObject({ itemId: first, isRepeat: true, grade: 'correct', boxBefore: 1, boxAfter: 1 });
    expect(app.ready().session?.queue).toHaveLength(6); // a repeat never queues another repeat

    app.actions.next();
    expect(app.ready().session).toBeUndefined();
    expect(app.ready().screen).toBe('done');
    app.db.close();
  });

  it('midnight: Leitner uses the answer day, the counter stays on the round day (03 §4.5)', async () => {
    const app = await setup({ at: new Date(2026, 10, 2, 23, 58).getTime() });
    expect(app.ready().session?.day).toBe('2026-11-02');
    app.clock.set(new Date(2026, 10, 3, 0, 2).getTime());
    await app.answer('wrong');

    const p = await app.db.get('progress', ids[0] ?? '');
    expect(p).toMatchObject({ introducedOn: '2026-11-03', lastAnsweredOn: '2026-11-03', dueOn: '2026-11-04' });
    expect(await app.db.get('dailyCounters', '2026-11-02')).toEqual({ day: '2026-11-02', newIntroduced: 1, reviewsAnswered: 0 });
    expect(await app.db.get('dailyCounters', '2026-11-03')).toBeUndefined();
    expect((await app.db.getAll('answerLog'))[0]?.day).toBe('2026-11-03');
    app.db.close();
  });

  it('Sonraki skips a card flagged after it was queued as a repeat', async () => {
    const app = await setup();
    const first = ids[0] ?? '';
    await app.answer('wrong');
    await app.actions.toggleFlag();
    for (let i = 1; i < 5; i++) {
      app.actions.next();
      await app.answer('correct');
    }
    app.actions.next(); // the flagged repeat is skipped → round end
    expect(app.ready().flags.has(first)).toBe(true);
    expect(app.ready().session).toBeUndefined();
    app.db.close();
  });
});
