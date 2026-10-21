import { describe, expect, it } from 'vitest';
import { fixedClock } from './clock.ts';
import { addDays } from './dates.ts';
import {
  buildRound,
  DAILY_DUE_CAP,
  DAILY_NEW_CAP,
  eligibleDue,
  eligibleNew,
  ROUND_SIZE,
  todayCount,
  type Pools,
} from './session.ts';
import type { Box, DailyCounter, DayKey, Item, Progress } from './types.ts';

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
  for (const id of spec.newIds ?? []) items.set(id, item(id));
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
    expect(round.slice(3).map((e) => e.itemId)).toEqual(ids('n', 5));
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
