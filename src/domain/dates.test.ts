import { describe, expect, it } from 'vitest';
import { addDays, compareDays, isDayKey, toDayKey } from './dates.ts';
import { fixedClock } from './clock.ts';

describe('addDays', () => {
  it('adds within a month', () => {
    expect(addDays('2026-11-02', 1)).toBe('2026-11-03');
    expect(addDays('2026-11-02', 16)).toBe('2026-11-18');
  });
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 2)).toBe('2027-01-02');
  });
  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });
  it('is not shifted by DST transitions (calendar day is fixed)', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });
  it('supports negative offsets', () => {
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
  it('rejects malformed keys', () => {
    expect(() => addDays('2026-2-1', 1)).toThrow();
    expect(() => addDays('2026-02-30', 1)).toThrow();
  });
});

describe('compareDays / isDayKey', () => {
  it('orders days', () => {
    expect(compareDays('2026-11-02', '2026-11-03')).toBe(-1);
    expect(compareDays('2026-11-03', '2026-11-03')).toBe(0);
    expect(compareDays('2027-01-02', '2026-12-31')).toBe(2);
  });
  it('validates keys', () => {
    expect(isDayKey('2026-11-02')).toBe(true);
    expect(isDayKey('2026-13-01')).toBe(false);
    expect(isDayKey('2026-11-02T00:00')).toBe(false);
  });
});

describe('toDayKey / clock', () => {
  it('uses the local calendar day', () => {
    const local = new Date(2026, 10, 2, 23, 59).getTime();
    expect(toDayKey(local)).toBe('2026-11-02');
    expect(toDayKey(local + 60_000)).toBe('2026-11-03');
  });
  it('fixedClock moves', () => {
    const c = fixedClock(new Date(2026, 10, 2, 8).getTime());
    expect(c.today()).toBe('2026-11-02');
    c.advance(86_400_000);
    expect(c.today()).toBe('2026-11-03');
  });
});
