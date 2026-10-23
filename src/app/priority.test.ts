import { describe, expect, it } from 'vitest';
import { createCatalog } from '../content/catalog.ts';
import { cachedOrder, poolsOf } from './round.ts';
import { AREAS } from '../domain/areas.ts';
import type { DiagnosticQuestion, Topic } from '../domain/extrasSchema.ts';
import { latestFinished, priorityItems } from '../domain/priority.ts';
import type { ContentBundle, DailyCounter, DiagnosticAttempt, Item } from '../domain/types.ts';

const [A1, A2, A3] = [AREAS[0]?.id ?? '', AREAS[1]?.id ?? '', AREAS[2]?.id ?? ''];
const q = (area: string, related: string[]): DiagnosticQuestion => ({ id: `dq-${area}`, area, relatedItemIds: related }) as unknown as DiagnosticQuestion;
const t = (area: string, ids: string[]): Topic => ({ id: `t-${area}`, area, itemIds: ids }) as unknown as Topic;
const extras = {
  diagnostic: [q(A1, ['l2', 'l1a']), q(A2, ['l3']), q(A3, ['l1b'])],
  topics: [t(A1, ['l3b']), t(A3, ['l1b'])],
};
const weak = { correct: 0, unsure: 1, wrong: 2 };
const strong = { correct: 3, unsure: 0, wrong: 0 };
const att = (areaResults: DiagnosticAttempt['areaResults'], finishedAt?: number): DiagnosticAttempt => ({
  id: `a-${finishedAt}`, startedAt: 1, ...(finishedAt === undefined ? {} : { finishedAt }), extrasVersion: 'v', order: [], cursor: 0, answers: {},
  ...(areaResults ? { areaResults } : {}),
});

const base: Item = {
  id: 'a', category: 'aux_to', level: 1, targetChunk: 't', clozeTemplate: '___', situationTr: 's',
  acceptedAnswers: ['x'], modelSentences: ['x'], checklistTr: ['c'], noteTr: 'n', source: 'curated', verified: true, verifiedNote: 'v',
};
const bundle: ContentBundle = {
  contentVersion: 'v1', generatedAt: '',
  items: [
    { ...base, id: 'l2', level: 2 }, { ...base, id: 'l1a' }, { ...base, id: 'mine', level: 3, source: 'user-error' },
    { ...base, id: 'l1b' }, { ...base, id: 'l3', level: 3 }, { ...base, id: 'l3b', level: 3 },
  ],
};
const catalog = createCatalog(bundle);
const counter: DailyCounter = { day: '2026-11-02', newCount: 0, practice: 0 } as unknown as DailyCounter;
const orderFor = (attempts: DiagnosticAttempt[]) => {
  const set = priorityItems(latestFinished(attempts), extras);
  return poolsOf({ catalog, progress: new Map(), flags: new Set(), meta: { dailyNewCap: 10 }, newPriority: set } as never, counter).newOrder;
};

describe('priorityItems', () => {
  it('(1) no attempt gives an empty set and today\'s order', () => {
    expect(priorityItems(undefined, extras).size).toBe(0);
    expect(orderFor([])).toEqual(cachedOrder(catalog));
    expect(orderFor([])).toEqual(['mine', 'l1a', 'l1b', 'l2', 'l3', 'l3b']);
  });
  it('(2) one weak area: its items follow the notebook, in level order', () => {
    const r = { [A1]: weak, [A2]: strong, [A3]: strong };
    expect([...priorityItems(att(r, 5), extras)].sort()).toEqual(['l1a', 'l2', 'l3b']);
    expect(orderFor([att(r, 5)])).toEqual(['mine', 'l1a', 'l2', 'l3b', 'l1b', 'l3']);
  });
  it('(3) several weak areas: union, each keeps level order', () => {
    const r = { [A1]: weak, [A2]: weak, [A3]: weak };
    expect(orderFor([att(r, 5)])).toEqual(['mine', 'l1a', 'l1b', 'l2', 'l3', 'l3b']);
    const r2 = { [A1]: strong, [A2]: weak, [A3]: weak };
    expect(orderFor([att(r2, 5)])).toEqual(['mine', 'l1b', 'l3', 'l1a', 'l2', 'l3b']);
  });
  it('(4) unfinished attempt is ignored; the latest finished one wins', () => {
    const r = { [A1]: weak, [A2]: strong, [A3]: strong };
    expect(priorityItems(att(undefined), extras).size).toBe(0);
    expect(orderFor([att(r)])).toEqual(orderFor([]));
    const old = att({ [A1]: strong, [A2]: weak, [A3]: strong }, 1);
    expect(orderFor([att(r, 9), old])).toEqual(['mine', 'l1a', 'l2', 'l3b', 'l1b', 'l3']);
  });
});
