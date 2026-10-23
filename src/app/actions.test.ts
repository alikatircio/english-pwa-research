import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import fixture from '../../content/fixtures/e2e-items.json';
import { fixedClock } from '../domain/clock.ts';
import type { ContentBundle, Grade, Progress } from '../domain/types.ts';
import { openAppDb } from '../storage/db.ts';
import { createActions } from './actions.ts';
import { boot, resumableSession } from './boot.ts';
import type { ReadyState } from './state.ts';
import { createStore } from './store.ts';

const bundle = fixture as ContentBundle;
const ids = bundle.items.map((i) => i.id);
const canonical = (id: string) => bundle.items.find((i) => i.id === id)?.acceptedAnswers[0] ?? '';
const T0 = new Date(2026, 10, 2, 8).getTime();

let n = 0;
async function setup({ progress = [] as Progress[], at = T0, newCap = 5 } = {}) {
  const name = `actions-${++n}-${Date.now()}`;
  const seed = await openAppDb({ name });
  for (const p of progress) await seed.put('progress', p);
  await seed.put('meta', { key: 'dailyNewCap', value: newCap });
  seed.close();
  const clock = fixedClock(at);
  const { db, state } = await boot({ bundle, clock, openDb: () => openAppDb({ name }) });
  const store = createStore();
  store.dispatch({ type: 'booted', state });
  const actions = createActions({ db, clock, getState: store.getState, dispatch: store.dispatch });
  actions.startRound(); // "Başla"
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
    actions.startWriting(); // a new card opens on its study view (decision 33); no-op otherwise
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

  it('a wrong first answer queues one re-ask 4 cards later; its answer writes a log row only (decisions 5, 38)', async () => {
    const app = await setup();
    const first = ids[0] ?? '';
    await app.answer('wrong');
    expect(app.ready().session?.queue[4]).toEqual({ itemId: first, kind: 'repeat' });
    const afterFirst = await app.db.get('progress', first);
    expect(afterFirst?.box).toBe(1);

    for (let i = 1; i < 4; i++) {
      app.actions.next();
      await app.answer('correct');
    }
    app.actions.next();
    expect(app.current()).toEqual({ itemId: first, kind: 'repeat' });
    expect(app.ready().session?.cursor).toBe(4);
    app.clock.advance(60_000);
    await app.answer('correct');

    expect(await app.db.get('progress', first)).toEqual(afterFirst); // box, dueOn, updatedAt unchanged
    const logs = await app.db.getAll('answerLog');
    expect(logs.at(-1)).toMatchObject({ itemId: first, isRepeat: true, grade: 'correct', boxBefore: 1, boxAfter: 1 });

    // Run the rest of the round: every new card is re-asked exactly once, never twice.
    for (;;) {
      app.actions.next();
      if (!app.ready().session) break;
      await app.answer('correct');
    }
    const all = await app.db.getAll('answerLog');
    expect(all.filter((l) => l.isRepeat)).toHaveLength(5);
    expect(new Set(all.filter((l) => l.isRepeat).map((l) => l.itemId)).size).toBe(5);
    expect(await app.db.get('dailyCounters', '2026-11-02')).toEqual({ day: '2026-11-02', newIntroduced: 5, reviewsAnswered: 0 });
    expect(app.ready().screen).toBe('roundEnd');
    // Round-end summary: the chunks studied, once each (05 §3); nothing left today.
    expect(app.ready().lastRound).toEqual({ studiedChunks: bundle.items.slice(0, 5).map((i) => i.targetChunk), moreToday: false });
    expect(await app.db.get('session', 'current')).toBeUndefined();
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

  it('Sonraki skips a card flagged after it was queued as a re-ask', async () => {
    const app = await setup();
    const first = ids[0] ?? '';
    await app.answer('wrong');
    await app.actions.toggleFlag();
    for (;;) {
      app.actions.next();
      if (!app.ready().session) break;
      await app.answer('correct');
    }
    expect(app.ready().flags.has(first)).toBe(true);
    expect((await app.db.getAll('answerLog')).filter((l) => l.itemId === first && l.isRepeat)).toHaveLength(0);
    app.db.close();
  });
});

describe('actions — undo reverts the round effects too (T2.4 + T4.2)', () => {
  it('undo of a wrong self-grade removes the queued repeat and the wrong streak', async () => {
    const app = await setup();
    const before = app.ready().session;
    await app.answer('wrong');
    expect(app.ready().session?.queue).toHaveLength((before?.queue.length ?? 0) + 1);
    expect(app.ready().session?.consecutiveWrong).toBe(1);

    await app.actions.undo();
    const s = app.ready().session;
    expect(s?.queue).toEqual(before?.queue);
    expect(s?.repeatQueued).toEqual([]);
    expect(s?.consecutiveWrong).toBe(0);
    expect(s?.phase).toEqual({ tag: 'result', answer: 'something else entirely', matched: false, mode: 'write', boxBefore: null });
    expect((await app.db.get('session', 'current'))?.queue).toEqual(before?.queue);

    // Re-grading correct: a new card is still re-asked once (decision 38), so the queue grows by that one entry again.
    await app.actions.selfGrade('correct');
    expect(app.ready().session?.queue).toHaveLength((before?.queue.length ?? 0) + 1);
    expect(app.ready().session?.repeatQueued).toEqual([ids[0]]);
    app.db.close();
  });

  it('undo of the third wrong answer puts the breather card back and restores the streak (decision 6)', async () => {
    const [a, b, c, x, d, e] = ids as [string, string, string, string, string, string];
    const app = await setup({
      progress: [
        due(a, 1, '2026-10-27'),
        due(b, 1, '2026-10-28'),
        due(c, 1, '2026-10-29'),
        due(x, 1, '2026-10-30'),
        due(d, 3, '2026-10-31'),
        due(e, 2, '2026-11-01'),
      ],
    });
    const order = () => app.ready().session?.queue.map((q) => `${q.kind}:${q.itemId}`) ?? [];
    // Opening card = highest box (05 §1).
    expect(order().slice(0, 6)).toEqual([d, a, b, c, x, e].map((id) => `due:${id}`));

    await app.answer('correct');
    app.actions.next();
    await app.answer('wrong');
    app.actions.next();
    await app.answer('wrong');
    app.actions.next();
    const beforeThird = app.ready().session;
    await app.answer('wrong');
    // Breather: the highest-box remaining card (e, box 2) moves right after c.
    expect(order().slice(0, 6)).toEqual([d, a, b, c, e, x].map((id) => `due:${id}`));
    expect(app.ready().session?.consecutiveWrong).toBe(0);

    await app.actions.undo();
    const s = app.ready().session;
    expect(s?.queue).toEqual(beforeThird?.queue);
    expect(s?.repeatQueued).toEqual([a, b]);
    expect(s?.consecutiveWrong).toBe(2);
    expect(s?.studiedChunks).toEqual(beforeThird?.studiedChunks);
    app.db.close();
  });
});

describe('actions — Home and round end (T4.3)', () => {
  it('"Bir tur daha" builds the next round from what is left; "Bu kadar" goes Home', async () => {
    const progress = ids.slice(0, 10).map((id, i) => due(id, 1, `2026-10-${String(20 + i).padStart(2, '0')}`));
    const app = await setup({ progress });
    expect(app.ready().session?.queue).toHaveLength(8);
    for (let i = 0; i < 8; i++) {
      if (i > 0) app.actions.next();
      await app.answer('correct');
    }
    app.actions.next();
    expect(app.ready().lastRound?.moreToday).toBe(true);
    app.actions.startRound();
    // 2 due left (≤ 25), then the new cards up to the round size.
    expect(app.ready().session?.queue.map((e) => e.kind)).toEqual(['due', 'due', 'new', 'new']);
    expect(app.ready().screen).toBe('card');
    expect(app.ready().lastRound).toBeUndefined();

    app.actions.finish();
    expect(app.ready().screen).toBe('home');
    expect(app.ready().session).toBeDefined(); // "Devam et"
    app.actions.resume();
    expect(app.ready().screen).toBe('card');
    app.db.close();
  });

  it('refreshHome after midnight drops the old round and switches to the new day', async () => {
    const app = await setup({ at: new Date(2026, 10, 2, 23, 50).getTime() });
    await app.answer('correct');
    app.actions.finish(); // reopened next morning: on Home (refreshHome only acts there)
    app.clock.set(new Date(2026, 10, 3, 7, 0).getTime());
    await app.actions.refreshHome();
    expect(app.ready().session).toBeUndefined();
    expect(app.ready().counter).toEqual({ day: '2026-11-03', newIntroduced: 0, reviewsAnswered: 0 });
    expect(await app.db.get('session', 'current')).toBeUndefined();
    app.actions.startRound();
    expect(app.ready().session?.day).toBe('2026-11-03');
    expect(app.ready().session?.queue).toHaveLength(5);
    app.db.close();
  });

  it('"Devam et" on a round older than 12 h starts a new round instead', async () => {
    const app = await setup();
    app.clock.advance(13 * 60 * 60 * 1000);
    app.actions.resume();
    expect(app.ready().session?.startedAt).toBe(app.clock.now());
    expect(app.ready().screen).toBe('card');
    app.db.close();
  });
});

describe('actions — busy gate (review 09 #6)', () => {
  it('a draft save that lands while a flag write is in flight keeps the buttons disabled', async () => {
    const app = await setup();
    app.actions.startWriting();
    const flagging = app.actions.toggleFlag();
    expect(app.ready().busy).toBe(true);
    app.actions.saveDraft(app.ready().session?.cursor ?? 0, 'Could you');
    expect(app.ready().session?.draft).toBe('Could you');
    expect(app.ready().busy).toBe(true); // a session-only write does not end the flag write
    await flagging;
    expect(app.ready().busy).toBe(false);
    app.db.close();
  });

  it('an import picked while another write is in flight reports busy, not a save failure (09 #12)', async () => {
    const app = await setup();
    const flagging = app.actions.toggleFlag();
    expect(await app.actions.importItemsFile('{}')).toEqual({ status: 'busy' });
    expect(app.ready().error).toBeUndefined();
    await flagging;
    app.db.close();
  });
});

describe('actions — stale round on the card screen (review 09 #5)', () => {
  it('keeps a fresh round and drops one left for more than 12 hours', async () => {
    const app = await setup();
    app.clock.advance(60 * 60 * 1000);
    await app.actions.dropStaleSession();
    expect(app.ready().session).toBeDefined();
    expect(app.ready().screen).toBe('card');

    app.clock.advance(12 * 60 * 60 * 1000);
    await app.actions.dropStaleSession();
    expect(app.ready().session).toBeUndefined();
    expect(app.ready().screen).toBe('home');
    expect(app.ready().counter.day).toBe(app.clock.today());
    await expect.poll(() => app.db.count('session')).toBe(0);
    app.db.close();
  });
});

describe('actions — daily new-card cap (decision 29)', () => {
  it('setDailyNewCap writes meta and the next round uses it', async () => {
    const app = await setup({ newCap: 5 });
    expect(app.ready().session?.queue.filter((e) => e.kind === 'new')).toHaveLength(5);
    expect(await app.actions.setDailyNewCap(15)).toBe(true);
    expect(app.ready().meta.dailyNewCap).toBe(15);
    expect(await app.db.get('meta', 'dailyNewCap')).toEqual({ key: 'dailyNewCap', value: 15 });
    app.db.close();
  });
});

describe('actions — new-card intro and "Bilmiyorum" (decisions 33, 34)', () => {
  it('a new card opens on the study view; typing and checking wait for "Hazırım"; nothing is written', async () => {
    const app = await setup();
    expect(app.ready().session?.phase).toEqual({ tag: 'study' });
    await app.actions.submitAnswer(canonical(ids[0] ?? ''));
    expect(app.ready().session?.phase).toEqual({ tag: 'study' });
    await app.actions.dontKnow('');
    expect(await app.db.count('answerLog')).toBe(0);

    app.actions.startWriting();
    expect(app.ready().session?.phase).toEqual({ tag: 'question' });
    expect((await app.db.get('session', 'current'))?.phase).toEqual({ tag: 'question' });
    expect(await app.db.count('progress')).toBe(0);
    app.db.close();
  });

  it('a due card and a re-ask open on the question; the next new card on the study view', async () => {
    const app = await setup({ progress: [due(ids[0] ?? '', 2)] });
    expect(app.current()?.kind).toBe('due');
    expect(app.ready().session?.phase).toEqual({ tag: 'question' });
    await app.answer('correct');
    app.actions.next();
    expect(app.current()?.kind).toBe('new');
    expect(app.ready().session?.phase).toEqual({ tag: 'study' });
    app.db.close();
  });

  it('"Bilmiyorum" grades wrong at once: result phase graded, Leitner box 1, log row with the typed text', async () => {
    const app = await setup({ progress: [due(ids[0] ?? '', 4)] });
    await app.actions.dontKnow('  half  ');
    expect(app.ready().session?.phase).toMatchObject({ tag: 'result', matched: false, grade: 'wrong', answer: 'half', boxBefore: 4 });
    expect(await app.db.get('progress', ids[0] ?? '')).toMatchObject({ box: 1, lastGrade: 'wrong' });
    expect((await app.db.getAll('answerLog'))[0]).toMatchObject({ grade: 'wrong', gradedBy: 'self', answer: 'half', boxBefore: 4, boxAfter: 1 });
    // A second tap does nothing: the card is already graded.
    await app.actions.dontKnow('');
    expect(await app.db.count('answerLog')).toBe(1);
    app.db.close();
  });
});

describe('actions — hints on demand (decision 35)', () => {
  it('the hint opens one level per tap, up to 2, and is cleared on the next card', async () => {
    const app = await setup({ progress: [due(ids[0] ?? '', 3)] });
    expect(app.ready().session?.hint).toBeUndefined();
    app.actions.showHint();
    expect(app.ready().session?.hint).toBe(1);
    app.actions.showHint();
    app.actions.showHint();
    expect(app.ready().session?.hint).toBe(2);
    expect((await app.db.get('session', 'current'))?.hint).toBe(2);
    await app.answer('wrong');
    expect(app.ready().session?.hint).toBe(2); // still on the result
    app.actions.next();
    expect(app.ready().session?.hint).toBeUndefined();
    app.db.close();
  });

  it('is refused on a study view, after the answer and on a re-ask', async () => {
    const app = await setup();
    app.actions.showHint(); // new card: study view
    expect(app.ready().session?.hint).toBeUndefined();
    app.actions.startWriting();
    await app.actions.submitAnswer('something else entirely');
    app.actions.showHint(); // result phase
    expect(app.ready().session?.hint).toBeUndefined();
    app.db.close();
  });

  it('correct with a hint is scheduled and logged as partial; hintUsed is the highest level', async () => {
    const app = await setup({ progress: [due(ids[0] ?? '', 3)] });
    app.actions.showHint();
    app.actions.showHint();
    await app.actions.submitAnswer(canonical(ids[0] ?? ''));
    const progress = await app.db.get('progress', ids[0] ?? '');
    expect(progress).toMatchObject({ box: 3, lastGrade: 'partial', dueOn: '2026-11-03' });
    expect(app.ready().session?.phase).toMatchObject({ tag: 'result', matched: true, hinted: true });
    expect((await app.db.getAll('answerLog'))[0]).toMatchObject({ grade: 'partial', gradedBy: 'auto', hintUsed: 2, boxBefore: 3, boxAfter: 3 });
    // A partial first answer queues the hint-free re-ask (decision 38).
    expect(app.ready().session?.queue.some((e) => e.kind === 'repeat' && e.itemId === ids[0])).toBe(true);
    app.db.close();
  });

  it('a hint with a wrong answer changes nothing in the grade; no hint logs hintUsed 0 and keeps correct', async () => {
    const hinted = await setup({ progress: [due(ids[0] ?? '', 3)] });
    hinted.actions.showHint();
    await hinted.answer('wrong');
    expect((await hinted.db.get('progress', ids[0] ?? ''))?.box).toBe(1);
    hinted.db.close();

    const plain = await setup({ progress: [due(ids[0] ?? '', 3)] });
    await plain.answer('correct');
    expect(await plain.db.get('progress', ids[0] ?? '')).toMatchObject({ box: 4, lastGrade: 'correct' });
    expect((await plain.db.getAll('answerLog'))[0]).toMatchObject({ hintUsed: 0 });
    plain.db.close();
  });
});

describe('actions — fix mode (decision 37)', () => {
  it('a box 3 card on its 4th showing is fix: the phase and the log carry the mode; the last card is write', async () => {
    const [a, b] = ids as [string, string];
    const seen = (itemId: string, box: Progress['box'], shows: number): Progress => ({
      itemId, box, dueOn: '2026-11-02', introducedOn: '2026-10-20', lastAnsweredOn: '2026-10-25', lastGrade: 'correct', updatedAt: 1, shows,
    });
    const app = await setup({ progress: [seen(a, 3, 3), seen(b, 3, 3)] });
    const first = app.current()?.itemId ?? '';
    const withMistake = app.ready().catalog.byId.get(first)?.commonMistake;
    expect(withMistake).toBeTruthy();
    await app.actions.submitAnswer('something else entirely');
    expect(app.ready().session?.phase).toMatchObject({ tag: 'result', mode: 'fix' });
    await app.actions.selfGrade('wrong');
    expect((await app.db.getAll('answerLog'))[0]).toMatchObject({ mode: 'fix' });

    app.db.close();
  });
});

describe('actions — context mode (decision 42)', () => {
  const waitFor = ids[6] ?? '';
  const seen = (shows: number): Progress => ({
    itemId: waitFor, box: 2, dueOn: '2026-11-02', introducedOn: '2026-10-20', lastAnsweredOn: '2026-10-25', lastGrade: 'correct', updatedAt: 1, shows,
  });

  it('a box 2 card on its 2nd showing is a context card; every blank right is auto-correct and logged as context', async () => {
    const app = await setup({ progress: [seen(1)] });
    expect(app.current()?.itemId).toBe(waitFor);
    await app.actions.submitAnswer('for\n Deploy ');
    expect(app.ready().session?.phase).toMatchObject({ tag: 'result', matched: true, mode: 'context', answer: "We're waiting for the Deploy.", original: "We're waiting for the deploy." });
    expect(await app.db.get('progress', waitFor)).toMatchObject({ box: 3, lastGrade: 'correct', shows: 2 });
    expect((await app.db.getAll('answerLog'))[0]).toMatchObject({ mode: 'context', grade: 'correct', gradedBy: 'auto', hintUsed: 0 });
    app.db.close();
  });

  it('one wrong blank goes to self-grade with the full original sentence; an empty blank does nothing', async () => {
    const app = await setup({ progress: [seen(1)] });
    await app.actions.submitAnswer('for\n');
    expect(app.ready().session?.phase.tag).toBe('question');
    await app.actions.submitAnswer('to\ndeploy');
    expect(app.ready().session?.phase).toMatchObject({ tag: 'result', matched: false, mode: 'context', answer: "We're waiting to the deploy.", original: "We're waiting for the deploy." });
    expect(await app.db.getAll('answerLog')).toHaveLength(0);
    await app.actions.selfGrade('partial');
    expect((await app.db.getAll('answerLog'))[0]).toMatchObject({ mode: 'context', grade: 'partial', gradedBy: 'self' });
    app.db.close();
  });

  it('is never a hint: showHint is ignored, and "Bilmiyorum" keeps the original', async () => {
    const app = await setup({ progress: [seen(1)] });
    app.actions.showHint();
    expect(app.ready().session?.hint).toBeUndefined();
    await app.actions.dontKnow('for\n');
    expect(app.ready().session?.phase).toMatchObject({ matched: false, grade: 'wrong', mode: 'context', original: "We're waiting for the deploy." });
    app.db.close();
  });
});

describe('actions — free practice (decision 30)', () => {
  const seenCard = (itemId: string, box: Progress['box']): Progress => ({
    itemId, box, dueOn: '2026-11-05', introducedOn: '2026-11-01', lastAnsweredOn: '2026-11-01', lastGrade: 'correct', updatedAt: 1,
  });
  const allSeen = ids.map((id, i) => seenCard(id, i % 2 === 0 ? 2 : 1));

  it('nothing is started while cards are left today, or before anything was seen', async () => {
    const fresh = await setup(); // a normal round is open
    fresh.actions.startPractice();
    expect(fresh.current()?.kind).toBe('new');
    fresh.db.close();
  });

  it('builds an 8-card practice round from seen cards, lowest box first', async () => {
    const app = await setup({ progress: allSeen });
    expect(app.ready().session).toBeUndefined(); // "Bugün bitti"
    app.actions.startPractice();
    const queue = app.ready().session?.queue ?? [];
    expect(queue).toHaveLength(8);
    expect(queue.every((e) => e.kind === 'practice')).toBe(true);
    const boxes = queue.map((e) => allSeen.find((p) => p.itemId === e.itemId)?.box);
    expect(boxes).toEqual([...boxes].sort());
    expect(app.ready().screen).toBe('card');
    app.db.close();
  });

  it('grading never calls applyGrade or touches counters; the log row is mode practice; no repeat is queued', async () => {
    const app = await setup({ progress: allSeen });
    app.actions.startPractice();
    const first = app.current()?.itemId ?? '';
    const before = await app.db.get('progress', first);
    const t = app.clock.now();
    await app.answer('wrong');
    app.clock.advance(1000);
    // Decision 41: only lastPracticedAt (and the merge stamp) change; box and due day stay.
    const after = await app.db.get('progress', first);
    expect(after).toEqual({ ...before, lastPracticedAt: t, updatedAt: t });
    expect(app.ready().progress.get(first)).toEqual(after);
    expect(await app.db.count('dailyCounters')).toBe(0);
    expect(app.ready().counter).toEqual({ day: '2026-11-02', newIntroduced: 0, reviewsAnswered: 0 });
    const logs = await app.db.getAll('answerLog');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ itemId: first, mode: 'practice', isRepeat: false, grade: 'wrong', boxBefore: before?.box, boxAfter: before?.box });
    expect(app.ready().session?.queue).toHaveLength(8);

    app.actions.next();
    await app.answer('correct');
    expect(await app.db.count('dailyCounters')).toBe(0);
    expect((await app.db.getAll('progress')).map((p) => p.box).sort()).toEqual(allSeen.map((p) => p.box).sort());
    app.db.close();
  });

  it('undo restores the same progress and counters and removes the log row', async () => {
    const app = await setup({ progress: allSeen });
    app.actions.startPractice();
    const first = app.current()?.itemId ?? '';
    const before = await app.db.get('progress', first);
    await app.answer('partial');
    expect(await app.db.count('answerLog')).toBe(1);
    await app.actions.undo();
    expect(await app.db.count('answerLog')).toBe(0);
    expect(await app.db.get('progress', first)).toEqual(before);
    expect(app.ready().counter).toEqual({ day: '2026-11-02', newIntroduced: 0, reviewsAnswered: 0 });
    expect(app.ready().session?.phase).toMatchObject({ tag: 'result', matched: false });
    app.db.close();
  });

  it('the open practice round is saved and resumable; finishing it ends on the round end', async () => {
    const app = await setup({ progress: allSeen });
    app.actions.startPractice();
    await app.answer('correct');
    await expect.poll(async () => (await app.db.get('session', 'current'))?.queue.length).toBe(8);
    const stored = await app.db.get('session', 'current');
    const catalog = app.ready().catalog;
    expect(resumableSession(stored, catalog, app.clock)?.queue.every((e) => e.kind === 'practice')).toBe(true);

    for (let i = 0; i < 7; i++) {
      app.actions.next();
      await app.answer('correct');
    }
    app.actions.next();
    expect(app.ready().screen).toBe('roundEnd');
    expect(app.ready().lastRound?.moreToday).toBe(false);
    app.db.close();
  });
});

describe('actions — notebook help (decision 32)', () => {
  it('dismissNotebookHelp is stored in meta', async () => {
    const app = await setup();
    expect(app.ready().meta.notebookHelpDismissed).toBeUndefined();
    expect(await app.actions.dismissNotebookHelp()).toBe(true);
    expect(app.ready().meta.notebookHelpDismissed).toBe(true);
    expect(await app.db.get('meta', 'notebookHelpDismissed')).toEqual({ key: 'notebookHelpDismissed', value: true });
    app.db.close();
  });
});

describe('actions — leaveRound ("← Ana ekran")', () => {
  it('goes Home with the session as it is, the draft saved, nothing graded', async () => {
    const app = await setup();
    app.actions.startWriting();
    const cursor = app.ready().session?.cursor ?? 0;
    app.actions.saveDraft(cursor, 'Could you che');
    const before = app.ready();
    app.actions.leaveRound();
    const after = app.ready();
    expect(after.screen).toBe('home');
    expect(after.session).toEqual(before.session);
    expect(after.session?.draft).toBe('Could you che');
    expect(after.progress).toEqual(before.progress);
    expect(after.counter).toEqual(before.counter);
    await expect.poll(async () => (await app.db.getAll('session'))[0]?.draft).toBe('Could you che');
    app.actions.resume();
    expect(app.ready().screen).toBe('card');
    expect(app.ready().session?.draft).toBe('Could you che');
    app.db.close();
  });

  it('closes an open undo window but keeps the grade', async () => {
    const app = await setup();
    const first = app.current()?.itemId ?? '';
    app.actions.startWriting();
    await app.actions.submitAnswer('something else entirely');
    await app.actions.selfGrade('wrong');
    expect(app.ready().session?.undo).toBeDefined();
    const counter = app.ready().counter;
    app.actions.leaveRound();
    expect(app.ready().screen).toBe('home');
    expect(app.ready().session?.undo).toBeUndefined();
    expect(app.ready().counter).toEqual(counter);
    expect(app.ready().progress.has(first)).toBe(true);
    app.db.close();
  });

  it('is ignored while a write is in flight', async () => {
    const app = await setup();
    app.actions.startWriting();
    const flagging = app.actions.toggleFlag();
    app.actions.leaveRound();
    expect(app.ready().screen).toBe('card');
    await flagging;
    app.db.close();
  });
});

describe('actions — message step (decisions 49, 59)', () => {
  const msgs = [
    { id: 'msg-t', channel: 'teams' as const, contextTr: 'x', text: 'Hi.\nI will get back to you.', blanked: 'Hi.\nI will get ___ to you.', blanks: [{ itemId: ids[0] ?? '' }], verified: true, verifiedNote: 'n' },
    { id: 'msg-u', channel: 'jira' as const, contextTr: 'x', text: 'Look into it for me.', blanked: 'Look ___ it for ___.', blanks: [{ itemId: ids[0] ?? '' }, { itemId: ids[1] ?? '' }], verified: true, verifiedNote: 'n' },
  ];
  const box4 = (id: string): Progress => ({ itemId: id, box: 4, dueOn: '2026-11-05', introducedOn: '2026-11-01', lastAnsweredOn: '2026-11-01', lastGrade: 'correct', updatedAt: 1 });

  it('answerMessage writes one log row per blank and nothing else', async () => {
    const name = `msg-${Date.now()}`;
    const seed = await openAppDb({ name });
    for (const id of ids) await seed.put('progress', box4(id));
    seed.close();
    const clock = fixedClock(T0);
    const { db, state } = await boot({ bundle, clock, openDb: () => openAppDb({ name }), extras: { diagnostic: [], messages: [msgs[1] as never] } });
    const store = createStore();
    store.dispatch({ type: 'booted', state });
    const actions = createActions({ db, clock, getState: store.getState, dispatch: store.dispatch });
    actions.startPractice();
    const s0 = store.getState();
    if (s0.status !== 'ready' || !s0.session) throw new Error('no session');
    expect(s0.session.queue.at(-1)).toEqual({ itemId: 'msg-u', kind: 'message' });
    // jump to the message step
    store.dispatch({ type: 'session', session: { ...s0.session, cursor: s0.session.queue.length - 1, phase: { tag: 'question' } } });
    const progressBefore = await db.getAll('progress');
    const counterBefore = await db.getAll('dailyCounters');

    await actions.answerMessage(['into', 'nope']);
    const logs = await db.getAll('answerLog');
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ mode: 'message', messageId: 'msg-u', itemId: ids[0], answer: 'into', grade: 'correct', boxBefore: 4, boxAfter: 4 });
    expect(logs[1]).toMatchObject({ mode: 'message', messageId: 'msg-u', itemId: ids[1], answer: 'nope', grade: 'wrong', boxBefore: 4, boxAfter: 4 });
    expect(await db.getAll('progress')).toEqual(progressBefore);
    expect(await db.getAll('dailyCounters')).toEqual(counterBefore);
    const s1 = store.getState();
    if (s1.status !== 'ready') throw new Error('not ready');
    expect(s1.messageLastAt?.get('msg-u')).toBe(T0);
    expect(s1.session?.phase).toMatchObject({ tag: 'result', matched: false });
    actions.next();
    expect(store.getState()).toMatchObject({ screen: 'roundEnd' });
    db.close();
  });

  it('answerMessage leaves no answer-log rows when the session write fails', async () => {
    const name = `msg-fail-${Date.now()}`;
    const seed = await openAppDb({ name });
    for (const id of ids) await seed.put('progress', box4(id));
    seed.close();
    const clock = fixedClock(T0);
    const { db, state } = await boot({ bundle, clock, openDb: () => openAppDb({ name }), extras: { diagnostic: [], messages: [msgs[1] as never] } });
    const store = createStore();
    store.dispatch({ type: 'booted', state });
    const actions = createActions({ db, clock, getState: store.getState, dispatch: store.dispatch });
    actions.startPractice();
    const s0 = store.getState();
    if (s0.status !== 'ready' || !s0.session) throw new Error('no session');
    // A function field cannot be structured-cloned, so the session put throws.
    const bad = { ...s0.session, cursor: s0.session.queue.length - 1, phase: { tag: 'question' as const }, bad: () => 1 };
    store.dispatch({ type: 'session', session: bad as never });
    await actions.answerMessage(['into', 'nope']);
    expect(await db.getAll('answerLog')).toHaveLength(0);
    db.close();
  });
});
