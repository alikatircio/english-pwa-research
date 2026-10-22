import { describe, expect, it } from 'vitest';
import { fixedClock } from './clock.ts';
import { addDays } from './dates.ts';
import { applyGrade } from './scheduler.ts';
import {
  advance,
  BREATHER_AFTER,
  buildRound,
  countFirstAnswer,
  currentEntry,
  DAILY_DUE_CAP,
  DAILY_NEW_CAP,
  eligibleDue,
  eligibleNew,
  isSessionStale,
  emptyCounter,
  newSession,
  onFirstAnswer,
  ROUND_SIZE,
  SESSION_MAX_AGE_MS,
  todayCount,
  type Pools,
} from './session.ts';
import type { Box, Category, DailyCounter, DayKey, Grade, Item, Progress, QueueEntry, SessionState } from './types.ts';

const today = '2026-11-02';

function item(id: string, extra: Partial<Item> = {}): Item {
  return {
    id,
    category: 'aux_to',
    targetChunk: `chunk-${id}`,
    clozeTemplate: '___',
    situationTr: 'durum',
    acceptedAnswers: ['answer'],
    modelSentences: ['Model.'],
    checklistTr: [],
    noteTr: '',
    source: 'curated',
    verified: true,
    level: 1,
    ...extra,
  };
}

function prog(itemId: string, box: Box, dueOn: DayKey = today, extra: Partial<Progress> = {}): Progress {
  return {
    itemId,
    box,
    dueOn,
    introducedOn: '2026-10-01',
    lastAnsweredOn: '2026-10-01',
    lastGrade: 'correct',
    updatedAt: 0,
    ...extra,
  };
}

const CATS: Category[] = ['aux_to', 'object', 'word_form', 'preposition', 'work_vocab'];

interface PoolSpec {
  due?: Progress[];
  newIds?: string[];
  flagged?: string[];
  counter?: Partial<DailyCounter>;
  extraItems?: Item[];
}

function pools(spec: PoolSpec): Pools {
  const items = new Map<string, Item>();
  for (const p of spec.due ?? []) items.set(p.itemId, item(p.itemId));
  // Spread new cards over categories so the decision-40 per-category cap does not interfere by default.
  (spec.newIds ?? []).forEach((id, i) => items.set(id, item(id, { category: CATS[i % CATS.length] ?? 'aux_to' })));
  for (const it of spec.extraItems ?? []) items.set(it.id, it);
  return {
    items,
    progress: new Map((spec.due ?? []).map((p) => [p.itemId, p])),
    flaggedIds: new Set(spec.flagged ?? []),
    counter: { day: today, newIntroduced: 0, reviewsAnswered: 0, ...spec.counter },
    newOrder: spec.newIds ?? [],
  };
}

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(2, '0')}`);
const dueCards = (n: number, box: Box = 1) => ids('d', n).map((id) => prog(id, box));

describe('constants', () => {
  it('match decisions 1–3', () => {
    expect([ROUND_SIZE, DAILY_NEW_CAP, DAILY_DUE_CAP]).toEqual([8, 5, 25]);
  });
});

describe('eligibleDue', () => {
  it('orders by dueOn ↑, then box ↑, then itemId ↑', () => {
    const p = pools({
      due: [
        prog('c', 2, today),
        prog('a', 3, '2026-10-30'),
        prog('b', 2, today),
        prog('z', 1, today),
        prog('y', 5, '2026-10-30'),
      ],
    });
    expect(eligibleDue(p, today)).toEqual(['a', 'y', 'z', 'b', 'c']);
  });

  it('skips cards not yet due', () => {
    const p = pools({ due: [prog('a', 1, today), prog('b', 1, addDays(today, 1))] });
    expect(eligibleDue(p, today)).toEqual(['a']);
  });

  it('treats a card answered "in the future" (clock moved back) as due', () => {
    const p = pools({ due: [prog('a', 2, addDays(today, 3), { lastAnsweredOn: addDays(today, 1) })] });
    expect(eligibleDue(p, today)).toEqual(['a']);
  });

  it('excludes flagged items and progress for items missing from the catalog', () => {
    const p = pools({ due: [prog('a', 1), prog('b', 1)], flagged: ['a'] });
    const orphan = new Map(p.progress).set('gone', prog('gone', 1));
    expect(eligibleDue({ ...p, progress: orphan }, today)).toEqual(['b']);
  });
});

describe('eligibleNew', () => {
  it('keeps newOrder and drops cards that already have progress', () => {
    const p = pools({ due: [prog('n2', 1, addDays(today, 5))], newIds: ['n3', 'n1', 'n2'] });
    expect(eligibleNew(p)).toEqual(['n3', 'n1']);
  });

  it('excludes flagged items, unknown ids and duplicates', () => {
    const p = { ...pools({ newIds: ['n1', 'n2'], flagged: ['n1'] }), newOrder: ['n1', 'ghost', 'n2', 'n2'] };
    expect(eligibleNew(p)).toEqual(['n2']);
  });

  it('notebook (user-error) items come first via newOrder and count toward the cap', () => {
    const curated = ids('c', 6);
    const p = pools({
      newIds: ['u1', ...curated],
      extraItems: [item('u1', { source: 'user-error' })],
      counter: { newIntroduced: 0 },
    });
    const round = buildRound(p, today);
    expect(round.map((e) => e.itemId)).toEqual(['u1', ...curated.slice(0, DAILY_NEW_CAP - 1)]);
  });
});

describe('buildRound', () => {
  it('30 due, nothing answered → 8 due cards', () => {
    const round = buildRound(pools({ due: dueCards(30), newIds: ids('n', 5) }), today);
    expect(round).toHaveLength(8);
    expect(round.every((e) => e.kind === 'due')).toBe(true);
  });

  it('30 due after 25 reviews → empty round and todayCount 0 (no new cards, 5 due left)', () => {
    const p = pools({ due: dueCards(30), newIds: ids('n', 5), counter: { reviewsAnswered: 25 } });
    expect(eligibleDue(p, today)).toHaveLength(30);
    expect(buildRound(p, today)).toEqual([]);
    expect(todayCount(p, today)).toBe(0);
  });

  it('caps due cards at the remaining daily budget', () => {
    const p = pools({ due: dueCards(30), counter: { reviewsAnswered: 22 } });
    expect(buildRound(p, today)).toHaveLength(3);
  });

  it('3 due + 10 new, newIntroduced=0 → 3 due then 5 new', () => {
    const round = buildRound(pools({ due: dueCards(3), newIds: ids('n', 10) }), today);
    expect(round.map((e) => e.kind)).toEqual(['due', 'due', 'due', 'new', 'new', 'new', 'new', 'new']);
    expect(round.slice(3).map((e) => e.itemId).sort()).toEqual(ids('n', 5));
  });

  it('3 due + 10 new, newIntroduced=4 → 3 due + 1 new', () => {
    const round = buildRound(pools({ due: dueCards(3), newIds: ids('n', 10), counter: { newIntroduced: 4 } }), today);
    expect(round.map((e) => e.kind)).toEqual(['due', 'due', 'due', 'new']);
  });

  it('no new cards once 5 were introduced today', () => {
    const p = pools({ newIds: ids('n', 10), counter: { newIntroduced: 5 } });
    expect(buildRound(p, today)).toEqual([]);
  });

  it('only new cards: up to 5, in newOrder', () => {
    const round = buildRound(pools({ newIds: ids('n', 10) }), today);
    expect(round).toEqual(ids('n', 5).map((itemId) => ({ itemId, kind: 'new' })));
  });

  it('backlog larger than the due budget blocks new cards even in the first round', () => {
    const round = buildRound(pools({ due: dueCards(26), newIds: ids('n', 5) }), today);
    expect(round).toHaveLength(8);
    expect(round.some((e) => e.kind === 'new')).toBe(false);
  });

  it('a backlog that exactly fits the budget still lets new cards in after it', () => {
    const p = pools({ due: dueCards(25), newIds: ids('n', 5) });
    expect(todayCount(p, today)).toBe(30);
  });

  it('opening card is the highest-box due card; the rest keep due order', () => {
    const p = pools({
      due: [prog('a', 1, '2026-10-30'), prog('b', 2, today), prog('c', 4, today), prog('d', 4, today), prog('e', 3, today)],
      newIds: ['n1'],
    });
    expect(buildRound(p, today).map((e) => e.itemId)).toEqual(['c', 'a', 'b', 'e', 'd', 'n1']);
  });

  it('opening card only considers cards that made it into the round', () => {
    const due = [...dueCards(8, 1), prog('z-high', 5, today)];
    const round = buildRound(pools({ due }), today);
    expect(round.map((e) => e.itemId)).toEqual(ids('d', 8));
  });

  it('flagged cards appear in neither list', () => {
    const p = pools({ due: [prog('a', 1), prog('b', 3)], newIds: ['n1', 'n2'], flagged: ['b', 'n1'] });
    expect(buildRound(p, today).map((e) => e.itemId)).toEqual(['a', 'n2']);
    expect(todayCount(p, today)).toBe(2);
  });

  it('nothing to do → [] ("Bugün bitti")', () => {
    expect(buildRound(pools({}), today)).toEqual([]);
    expect(todayCount(pools({}), today)).toBe(0);
  });
});

describe('buildRound — decision 40 (category spread)', () => {
  const cat = (id: string, category: Category): Item => item(id, { category });
  const cats = (r: QueueEntry[], p: Pools) => r.map((e) => p.items.get(e.itemId)?.category);

  it('avoids adjacent same-category cards when avoidable', () => {
    const p = pools({
      due: [prog('a1', 1), prog('a2', 1), prog('b1', 1), prog('b2', 1)],
      extraItems: [cat('a1', 'object'), cat('a2', 'object'), cat('b1', 'aux_to'), cat('b2', 'aux_to')],
    });
    const c = cats(buildRound(p, today), p);
    for (let i = 1; i < c.length; i++) expect(c[i]).not.toBe(c[i - 1]);
  });

  it('allows adjacency only when unavoidable', () => {
    const p = pools({ due: [prog('a', 1), prog('b', 1)], extraItems: [cat('a', 'object'), cat('b', 'object')] });
    expect(buildRound(p, today)).toHaveLength(2);
  });

  it('caps new cards at 2 per category, counting today introductions', () => {
    const p = pools({
      due: [prog('t1', 1, '2026-12-01', { introducedOn: today })],
      newIds: ['n1', 'n2', 'n3', 'n4'],
      extraItems: [cat('t1', 'object'), cat('n1', 'object'), cat('n2', 'aux_to'), cat('n3', 'object'), cat('n4', 'object')],
    });
    expect(buildRound(p, today).map((e) => e.itemId)).toEqual(['n1', 'n2']);
  });

  it('caps chosen-in-round cards and fewer new cards are fine', () => {
    const items = ['n1', 'n2', 'n3', 'n4'].map((id) => cat(id, 'object'));
    const p = pools({ newIds: ['n1', 'n2', 'n3', 'n4'], extraItems: items });
    expect(buildRound(p, today).map((e) => e.itemId)).toEqual(['n1', 'n2']);
  });

  it('keeps the highest-box opener first', () => {
    const p = pools({
      due: [prog('a', 1), prog('b', 1), prog('c', 4)],
      extraItems: [cat('a', 'object'), cat('b', 'aux_to'), cat('c', 'object')],
    });
    expect(buildRound(p, today)[0]?.itemId).toBe('c');
  });

  it('keeps notebook-first order among new cards when categories allow', () => {
    const p = pools({
      newIds: ['nb1', 'nb2', 'x1', 'x2'],
      extraItems: [cat('nb1', 'object'), cat('nb2', 'aux_to'), cat('x1', 'object'), cat('x2', 'aux_to')],
    });
    const ids2 = buildRound(p, today).map((e) => e.itemId);
    expect(ids2.slice(0, 2)).toEqual(['nb1', 'nb2']);
  });

  it('is deterministic and keeps due before new', () => {
    const p = pools({
      due: [prog('a', 2), prog('b', 1)],
      newIds: ['n1', 'n2', 'n3'],
      extraItems: [cat('a', 'object'), cat('b', 'object'), cat('n1', 'object'), cat('n2', 'aux_to'), cat('n3', 'object')],
    });
    const r1 = buildRound(p, today);
    expect(buildRound(p, today)).toEqual(r1);
    expect(r1.map((e) => e.kind)).toEqual(['due', 'due', 'new', 'new', 'new']);
  });
});

describe('todayCount', () => {
  it('min(due, budget) + new only while due fits in the budget', () => {
    expect(todayCount(pools({ due: dueCards(3), newIds: ids('n', 10) }), today)).toBe(8);
    expect(todayCount(pools({ due: dueCards(3), newIds: ids('n', 10), counter: { newIntroduced: 4 } }), today)).toBe(4);
    expect(todayCount(pools({ due: dueCards(40), newIds: ids('n', 10) }), today)).toBe(25);
    expect(todayCount(pools({ due: dueCards(40), newIds: ids('n', 10), counter: { reviewsAnswered: 10 } }), today)).toBe(
      15,
    );
  });

  it('is not limited by the round size', () => {
    expect(todayCount(pools({ due: dueCards(12) }), today)).toBe(12);
  });
});

describe('day boundary (injected clock)', () => {
  it('a card due tomorrow joins after local midnight', () => {
    const clock = fixedClock(new Date(2026, 10, 2, 23, 59).getTime());
    const p = pools({ due: [prog('a', 1, '2026-11-02'), prog('b', 2, '2026-11-03')] });
    expect(clock.today()).toBe('2026-11-02');
    expect(buildRound(p, clock.today()).map((e) => e.itemId)).toEqual(['a']);
    clock.advance(2 * 60_000);
    expect(clock.today()).toBe('2026-11-03');
    expect(buildRound(p, clock.today()).map((e) => e.itemId)).toEqual(['b', 'a']);
  });
});

// --- T4.2: answering and advancing ------------------------------------------

const q = (...spec: string[]): QueueEntry[] =>
  spec.map((s) => {
    const [kind, itemId] = s.split(':') as [QueueEntry['kind'], string];
    return { itemId, kind };
  });
const order = (s: SessionState) => s.queue.map((e) => `${e.kind}:${e.itemId}`);

/** Answer the current card with `grade`, then advance; returns the state on the next card. */
function step(s: SessionState, grade: Grade, p: Pools): SessionState {
  const next = advance(onFirstAnswer(s, grade, p));
  if (next === 'round-end') throw new Error('unexpected round end');
  return next;
}

describe('onFirstAnswer — end-of-round repeat', () => {
  const p = pools({ due: [prog('a', 2), prog('b', 3)], newIds: ['n1'] });
  const start = newSession(q('due:a', 'due:b', 'new:n1'), today, 0);

  it.each(['wrong', 'partial'] as const)('%s → appended once as repeat', (grade) => {
    const s = onFirstAnswer(start, grade, p);
    expect(order(s)).toEqual(['due:a', 'due:b', 'new:n1', 'repeat:a']);
    expect(s.repeatQueued).toEqual(['a']);
  });

  it('correct → nothing appended', () => {
    const s = onFirstAnswer(start, 'correct', p);
    expect(s.queue).toEqual(start.queue);
    expect(s.repeatQueued).toEqual([]);
  });

  it('a wrong repeat is not appended a second time and does not touch the counter', () => {
    let s = step(start, 'wrong', p);
    s = step(s, 'correct', p);
    s = step(s, 'correct', p);
    expect(currentEntry(s)).toEqual({ itemId: 'a', kind: 'repeat' });
    const after = onFirstAnswer(s, 'wrong', p);
    expect(order(after)).toEqual(['due:a', 'due:b', 'new:n1', 'repeat:a']);
    expect(after.consecutiveWrong).toBe(s.consecutiveWrong);
    expect(advance(after)).toBe('round-end');
  });

  it('a repeat answer leaves the queue alone; the box is untouched because the caller skips applyGrade', () => {
    const s = { ...start, cursor: 3, queue: [...start.queue, { itemId: 'a', kind: 'repeat' as const }] };
    const after = onFirstAnswer(s, 'correct', p);
    expect(after.queue).toEqual(s.queue);
    expect(p.progress.get('a')?.box).toBe(2);
    // Contrast: a first answer goes through the scheduler and would move the box.
    expect(applyGrade(p.progress.get('a') ?? null, 'correct', 'a', today, 1).box).toBe(3);
  });

  it('does not mutate the input state', () => {
    const snapshot = structuredClone(start);
    onFirstAnswer(start, 'wrong', p);
    expect(start).toEqual(snapshot);
  });

  it('is a no-op past the end of the queue', () => {
    const s = { ...start, cursor: 9 };
    expect(onFirstAnswer(s, 'wrong', p)).toBe(s);
  });
});

describe('onFirstAnswer — studied chunks', () => {
  it('records each targetChunk once, in answer order', () => {
    const p = pools({ due: [prog('a', 2), prog('b', 2)] });
    let s = newSession(q('due:a', 'due:b'), today, 0);
    s = step(s, 'wrong', p);
    s = onFirstAnswer(s, 'correct', p);
    expect(s.studiedChunks).toEqual(['chunk-a', 'chunk-b']);
    const r = advance(s);
    if (r === 'round-end') throw new Error('expected repeat');
    expect(onFirstAnswer(r, 'correct', p).studiedChunks).toEqual(['chunk-a', 'chunk-b']);
  });
});

describe('onFirstAnswer — 3 wrongs in a row (decision 6)', () => {
  const p = pools({
    due: [prog('a', 1), prog('b', 1), prog('c', 1), prog('d', 2), prog('e', 4), prog('f', 4)],
    newIds: ['n1'],
  });
  const start = newSession(q('due:a', 'due:b', 'due:c', 'new:n1', 'due:d', 'due:e', 'due:f'), today, 0);

  it(`after ${BREATHER_AFTER} wrongs the next card is the highest-box remaining card; counter resets`, () => {
    let s = step(start, 'wrong', p);
    s = step(s, 'wrong', p);
    expect(s.consecutiveWrong).toBe(2);
    s = onFirstAnswer(s, 'wrong', p);
    expect(s.consecutiveWrong).toBe(0);
    expect(order(s)).toEqual([
      'due:a',
      'due:b',
      'due:c',
      'due:e',
      'new:n1',
      'due:d',
      'due:f',
      'repeat:a',
      'repeat:b',
      'repeat:c',
    ]);
    const next = advance(s);
    expect(next !== 'round-end' && currentEntry(next)).toEqual({ itemId: 'e', kind: 'due' });
  });

  it('partial resets the streak (decision 25)', () => {
    let s = step(start, 'wrong', p);
    s = step(s, 'partial', p);
    expect(s.consecutiveWrong).toBe(0);
    s = step(s, 'wrong', p);
    s = onFirstAnswer(s, 'wrong', p);
    expect(s.consecutiveWrong).toBe(2);
    expect(order(s).slice(0, 7)).toEqual(order(start));
  });

  it('correct resets the streak', () => {
    let s = step(start, 'wrong', p);
    s = step(s, 'wrong', p);
    s = onFirstAnswer(s, 'correct', p);
    expect(s.consecutiveWrong).toBe(0);
  });

  it('new cards count as box 0 and repeats are never pulled forward', () => {
    const p2 = pools({ due: [prog('a', 1), prog('b', 1), prog('c', 1), prog('d', 1)], newIds: ['n1'] });
    let s = newSession(q('due:a', 'due:b', 'due:c', 'new:n1', 'due:d'), today, 0);
    s = step(s, 'wrong', p2);
    s = step(s, 'wrong', p2);
    s = onFirstAnswer(s, 'wrong', p2);
    expect(order(s).slice(3, 5)).toEqual(['due:d', 'new:n1']);

    // Only new cards left: repeat:a (box 1) still stays at the end.
    let t = newSession(q('due:a', 'due:b', 'due:c', 'new:n1', 'new:n2'), today, 0);
    t = step(t, 'wrong', p2);
    t = step(t, 'wrong', p2);
    t = onFirstAnswer(t, 'wrong', p2);
    expect(order(t)).toEqual(['due:a', 'due:b', 'due:c', 'new:n1', 'new:n2', 'repeat:a', 'repeat:b', 'repeat:c']);
  });

  it('with no main cards left, the queue is unchanged and the counter still resets', () => {
    const p3 = pools({ due: [prog('a', 1), prog('b', 1), prog('c', 1)] });
    let s = newSession(q('due:a', 'due:b', 'due:c'), today, 0);
    s = step(s, 'wrong', p3);
    s = step(s, 'wrong', p3);
    s = onFirstAnswer(s, 'wrong', p3);
    expect(order(s)).toEqual(['due:a', 'due:b', 'due:c', 'repeat:a', 'repeat:b', 'repeat:c']);
    expect(s.consecutiveWrong).toBe(0);
  });
});

describe('advance', () => {
  it('moves to the next card with a clean question phase, empty draft and no undo', () => {
    const s: SessionState = {
      ...newSession(q('due:a', 'due:b'), today, 0),
      phase: { tag: 'result', answer: 'x', matched: false, grade: 'wrong' },
      draft: 'typing',
      undo: {
        itemId: 'a', prevProgress: null, prevCounter: emptyCounter(today), logId: 1, expiresAt: 4000,
        prevRound: { queue: q('due:a', 'due:b'), repeatQueued: [], consecutiveWrong: 0, studiedChunks: [] },
      },
    };
    const next = advance(s);
    if (next === 'round-end') throw new Error('expected next card');
    expect(next.cursor).toBe(1);
    expect(next.phase).toEqual({ tag: 'question' });
    expect(next.draft).toBe('');
    expect('undo' in next).toBe(false);
    expect(s.undo).toBeDefined();
  });

  it("returns 'round-end' after the last card (including repeats)", () => {
    expect(advance(newSession(q('due:a'), today, 0))).toBe('round-end');
    expect(advance(newSession([], today, 0))).toBe('round-end');
  });
});

describe('countFirstAnswer', () => {
  it('new → newIntroduced++, due → reviewsAnswered++, repeat → unchanged', () => {
    const c = emptyCounter(today);
    expect(countFirstAnswer(c, 'new', today)).toEqual({ day: today, newIntroduced: 1, reviewsAnswered: 0 });
    expect(countFirstAnswer(c, 'due', today)).toEqual({ day: today, newIntroduced: 0, reviewsAnswered: 1 });
    expect(countFirstAnswer(c, 'repeat', today)).toBe(c);
  });

  it('counts across a round feed back into the next round', () => {
    const p = pools({ due: dueCards(3), newIds: ids('n', 10) });
    const round = buildRound(p, today);
    const counter = round.reduce((c, e) => countFirstAnswer(c, e.kind, today), emptyCounter(today));
    expect(counter).toEqual({ day: today, newIntroduced: 5, reviewsAnswered: 3 });
    expect(buildRound({ ...pools({ newIds: ids('n', 10).slice(5) }), counter }, today)).toEqual([]);
  });

  it("midnight: the queue keeps its day and counts go to that day's counter", () => {
    const clock = fixedClock(new Date(2026, 10, 2, 23, 58).getTime());
    const s = newSession(q('new:n1', 'new:n2'), clock.today(), clock.now());
    clock.advance(5 * 60_000);
    expect(clock.today()).toBe('2026-11-03');
    const next = advance(onFirstAnswer(s, 'correct', pools({ newIds: ['n1', 'n2'] })));
    expect(next !== 'round-end' && next.day).toBe('2026-11-02');
    expect(countFirstAnswer(emptyCounter(s.day), 'new', s.day).day).toBe('2026-11-02');
    expect(() => countFirstAnswer(emptyCounter(clock.today()), 'new', s.day)).toThrow(/does not match/);
  });
});

const staleDay = '2026-11-02';
const t0 = new Date(2026, 10, 2, 8).getTime();

describe('isSessionStale', () => {
  const s = newSession([{ itemId: 'a', kind: 'new' }], staleDay, t0);
  it('is fresh on the same day within 12 hours', () => {
    expect(isSessionStale(s, staleDay, t0 + SESSION_MAX_AGE_MS)).toBe(false);
  });
  it('is stale after 12 hours', () => {
    expect(isSessionStale(s, staleDay, t0 + SESSION_MAX_AGE_MS + 1)).toBe(true);
  });
  it('is stale on another day even within 12 hours', () => {
    expect(isSessionStale(s, '2026-11-03', t0 + 60_000)).toBe(true);
  });
});
