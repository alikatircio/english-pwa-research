import { describe, expect, it } from 'vitest';
import { applyGrade, INTERVALS, isDue } from './scheduler.ts';
import type { Box, Progress } from './types.ts';

const today = '2026-11-02';
const at = (box: Box, extra: Partial<Progress> = {}): Progress => ({
  itemId: 'x', box, dueOn: today, introducedOn: '2026-10-01', lastAnsweredOn: '2026-10-30', lastGrade: 'correct', updatedAt: 0, ...extra,
});

describe('INTERVALS', () => {
  it('doubles from 1 to 16 days', () => expect(INTERVALS).toEqual({ 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 }));
});

describe('applyGrade — new card', () => {
  it('correct → box 2, due in 2 days', () => {
    expect(applyGrade(null, 'correct', 'x', today, 5)).toEqual({
      itemId: 'x', box: 2, dueOn: '2026-11-04', introducedOn: today, lastAnsweredOn: today, lastGrade: 'correct', updatedAt: 5, shows: 1,
    });
  });
  it('counts every graded showing; older records without the field count as 1', () => {
    const base = { itemId: 'x', box: 2 as const, dueOn: today, introducedOn: today, lastAnsweredOn: today, lastGrade: 'correct' as const, updatedAt: 1 };
    expect(applyGrade({ ...base, shows: 4 }, 'wrong', 'x', today, 5).shows).toBe(5);
    expect(applyGrade(base, 'correct', 'x', today, 5).shows).toBe(2);
  });
  it.each(['partial', 'wrong'] as const)('%s → box 1, due tomorrow', (g) => {
    const p = applyGrade(null, g, 'x', today, 5);
    expect([p.box, p.dueOn, p.lastGrade]).toEqual([1, '2026-11-03', g]);
  });
});

describe('applyGrade — known card', () => {
  it.each([
    [1, 'correct', 2, '2026-11-04'],
    [2, 'correct', 3, '2026-11-06'],
    [3, 'correct', 4, '2026-11-10'],
    [4, 'correct', 5, '2026-11-18'],
    [5, 'correct', 5, '2026-11-18'],
    [4, 'partial', 4, '2026-11-03'],
    [1, 'partial', 1, '2026-11-03'],
    [4, 'wrong', 1, '2026-11-03'],
    [5, 'wrong', 1, '2026-11-03'],
  ] as const)('box %i + %s → box %i, due %s', (box, grade, nextBox, due) => {
    const p = applyGrade(at(box), grade, 'x', today, 9);
    expect(p.box).toBe(nextBox);
    expect(p.dueOn).toBe(due);
    expect(p.introducedOn).toBe('2026-10-01');
    expect(p.lastAnsweredOn).toBe(today);
  });
  it('crosses year boundaries and leap days', () => {
    expect(applyGrade(null, 'correct', 'x', '2026-12-31', 0).dueOn).toBe('2027-01-02');
    expect(applyGrade(null, 'wrong', 'x', '2028-02-28', 0).dueOn).toBe('2028-02-29');
    expect(applyGrade(at(4), 'correct', 'x', '2026-03-25', 0).dueOn).toBe('2026-04-10'); // spans a DST change
  });
  it('a card answered today is never due again today', () => {
    for (const g of ['correct', 'partial', 'wrong'] as const) expect(isDue(applyGrade(at(3), g, 'x', today, 0), today)).toBe(false);
  });
});

describe('isDue', () => {
  it('due on dueOn and after, not before', () => {
    expect(isDue(at(2, { dueOn: today }), today)).toBe(true);
    expect(isDue(at(2, { dueOn: '2026-11-01' }), today)).toBe(true);
    expect(isDue(at(2, { dueOn: '2026-11-03' }), today)).toBe(false);
  });
  it('treats a card answered in the future (clock moved back) as due', () => {
    expect(isDue(at(2, { dueOn: '2026-11-20', lastAnsweredOn: '2026-11-05' }), today)).toBe(true);
  });
});
