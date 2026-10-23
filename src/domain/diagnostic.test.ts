import { describe, expect, it } from 'vitest';
import { AREAS } from './areas.ts';
import {
  answerQuestion, diagnosticAvailable, finishAttempt, firstVsLatest, isComplete, nextQuestion, optionOrder, orderQuestions,
  prevQuestion, retakeDay, retakeSuggested, scoreByArea, startAttempt, studyPointers, verdictOf, weakAreas,
} from './diagnostic.ts';
import type { DiagnosticQuestion } from './extrasSchema.ts';
import type { DiagnosticAttempt } from './types.ts';

const mk = (area: string, n: number, correct: ('a' | 'b' | 'c' | 'd')[] = ['a']): DiagnosticQuestion => ({
  id: `dq-${area}-${n}`, area: area as DiagnosticQuestion['area'], category: 'grammar',
  refs: [{ book: 'Gram', unit: 25 }, { book: 'Coll', unit: 6 }], relatedItemIds: [`item-${area}-${n}`, 'shared-item'],
  promptTr: 'p', stem: 's', options: (['a', 'b', 'c', 'd'] as const).map((id) => ({ id, text: id })), correct,
  explanationTr: 'e', verified: true, verifiedNote: 'n',
});
const questions = AREAS.flatMap((a) => [1, 2, 3].map((n) => mk(a.id, n, n === 3 ? ['a', 'c'] : ['a'])));
const opts = { id: 'da-1', now: 1000, extrasVersion: 'x' };

describe('startAttempt / order', () => {
  it('is deterministic per id and never puts the same area twice in a row', () => {
    const a = startAttempt(questions, opts);
    expect(startAttempt(questions, opts).order).toEqual(a.order);
    expect(orderQuestions(questions, 'other')).not.toEqual(a.order);
    expect(a.order).toHaveLength(48);
    expect(new Set(a.order).size).toBe(48);
    const areaOf = (id: string) => questions.find((q) => q.id === id)?.area;
    for (let i = 1; i < 48; i++) expect(areaOf(a.order[i] ?? '')).not.toBe(areaOf(a.order[i - 1] ?? ''));
    expect(a).toMatchObject({ cursor: 0, answers: {}, startedAt: 1000 });
  });
  it('option order is a stable permutation per attempt + question', () => {
    const q = questions[0] as DiagnosticQuestion;
    const o = optionOrder('da-1', q);
    expect(o.toSorted()).toEqual(['a', 'b', 'c', 'd']);
    expect(optionOrder('da-1', q)).toEqual(o);
    expect(new Set(Array.from({ length: 20 }, (_, i) => optionOrder(`da-${i}`, q).join())).size).toBeGreaterThan(1);
  });
  it('empty bundle is unavailable', () => {
    expect(diagnosticAvailable([])).toBe(false);
    expect(diagnosticAvailable(questions)).toBe(true);
    expect(startAttempt([], opts).order).toEqual([]);
  });
});

describe('answer, cursor, scoring', () => {
  const q1 = mk('modals', 1);
  const q3 = mk('modals', 3, ['a', 'c']);
  const base: DiagnosticAttempt = { ...startAttempt([q1, q3], opts) };
  it('clamps cursor and keeps it on answer', () => {
    expect(prevQuestion(base).cursor).toBe(0);
    const n = nextQuestion(nextQuestion(nextQuestion(base)));
    expect(n.cursor).toBe(1);
    expect(answerQuestion(n, q1.id, ['a']).cursor).toBe(1);
  });
  it('multi-correct needs the exact set; unsure is separate; unknown id ignored', () => {
    expect(verdictOf(answerQuestion(base, q3.id, ['c', 'a']), q3)).toBe('correct');
    expect(verdictOf(answerQuestion(base, q3.id, ['a']), q3)).toBe('wrong');
    expect(verdictOf(answerQuestion(base, q3.id, ['a', 'b', 'c']), q3)).toBe('wrong');
    expect(verdictOf(answerQuestion(base, q3.id, 'unsure'), q3)).toBe('unsure');
    expect(verdictOf(base, q3)).toBe('wrong');
    expect(answerQuestion(base, 'nope', ['a'])).toBe(base);
    expect(isComplete(base)).toBe(false);
  });
  it('scoreByArea, weakAreas, finishAttempt', () => {
    let a = base;
    a = answerQuestion(a, q1.id, ['a']);
    a = answerQuestion(a, q3.id, 'unsure');
    expect(scoreByArea(a, [q1, q3])).toEqual({ modals: { correct: 1, unsure: 1, wrong: 0 } });
    expect(weakAreas(scoreByArea(a, [q1, q3]))).toEqual(['modals']);
    expect(weakAreas({ modals: { correct: 2, unsure: 0, wrong: 1 } })).toEqual([]);
    const f = finishAttempt(a, [q1, q3], 5000);
    expect(f.finishedAt).toBe(5000);
    expect(f.areaResults).toEqual({ modals: { correct: 1, unsure: 1, wrong: 0 } });
  });
});

describe('studyPointers', () => {
  it('formats refs and unions related items', () => {
    const p = studyPointers('modals', questions);
    expect(p.refs).toEqual(['Gram ünite 25 · k.50 · PDF 62', 'Coll ünite 6 · k.16 · PDF 20']);
    expect(p.relatedItemIds).toEqual(['item-modals-1', 'shared-item', 'item-modals-2', 'item-modals-3']);
  });
});

describe('history', () => {
  const day = (d: number) => new Date(2026, 0, d, 12).getTime();
  const att = (id: string, finishedAt: number | undefined, correct: number): DiagnosticAttempt => ({
    id, startedAt: finishedAt ?? 1, ...(finishedAt ? { finishedAt, areaResults: { modals: { correct, unsure: 0, wrong: 3 - correct } } } : {}),
    extrasVersion: 'x', order: [], cursor: 0, answers: {},
  });
  it('first vs latest ignores unfinished attempts', () => {
    expect(firstVsLatest([att('u', undefined, 0)])).toBeUndefined();
    const r = firstVsLatest([att('b', day(20), 3), att('a', day(1), 1), att('u', undefined, 0)]);
    expect(r?.first.id).toBe('a');
    expect(r?.latest.id).toBe('b');
    expect(r?.hasComparison).toBe(true);
    expect(r?.areas.find((x) => x.area === 'modals')).toMatchObject({ first: { correct: 1 }, latest: { correct: 3 } });
    expect(firstVsLatest([att('a', day(1), 1)])?.hasComparison).toBe(false);
  });
  it('retake after 28 days', () => {
    const list = [att('a', day(1), 1)];
    expect(retakeDay(list)).toBe('2026-01-29');
    expect(retakeSuggested(list, '2026-01-28')).toBe(false);
    expect(retakeSuggested(list, '2026-01-29')).toBe(true);
    expect(retakeSuggested([], '2030-01-01')).toBe(false);
  });
});
