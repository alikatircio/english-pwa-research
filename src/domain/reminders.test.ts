import { describe, expect, it } from 'vitest';
import { backupReminderDue, firstAnswerDay, isFirstRun } from './reminders.ts';
import type { Progress } from './types.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 20, 9).getTime();
const TODAY = '2026-11-20';

const prog = (itemId: string, introducedOn: string): Progress => ({
  itemId, box: 1, dueOn: introducedOn, introducedOn, lastAnsweredOn: introducedOn, lastGrade: 'wrong', updatedAt: 1,
});

describe('isFirstRun', () => {
  const empty = { firstRunAt: undefined, progress: 0, notebook: 0, imported: 0 };
  it('only an untouched, empty device is a first run', () => {
    expect(isFirstRun(empty)).toBe(true);
    expect(isFirstRun({ ...empty, firstRunAt: 1 })).toBe(false);
    expect(isFirstRun({ ...empty, progress: 1 })).toBe(false);
    expect(isFirstRun({ ...empty, notebook: 1 })).toBe(false);
    expect(isFirstRun({ ...empty, imported: 1 })).toBe(false);
  });
});

describe('firstAnswerDay', () => {
  it('is the earliest introducedOn, undefined with no progress', () => {
    expect(firstAnswerDay([])).toBeUndefined();
    expect(firstAnswerDay([prog('a', '2026-11-05'), prog('b', '2026-10-31'), prog('c', '2026-11-10')])).toBe('2026-10-31');
  });
});

describe('backupReminderDue (decision 27)', () => {
  const base = { now: NOW, today: TODAY, lastExportAt: undefined, firstAnswerDay: undefined, dismissedAt: undefined };

  it('never answered and never exported: no reminder', () => {
    expect(backupReminderDue(base)).toBe(false);
  });

  it('no export: due only when the first answer is more than 7 days ago', () => {
    expect(backupReminderDue({ ...base, firstAnswerDay: '2026-11-13' })).toBe(false); // exactly 7 days
    expect(backupReminderDue({ ...base, firstAnswerDay: '2026-11-12' })).toBe(true);
  });

  it('with an export: due only when it is more than 7 days old, whatever the first answer', () => {
    expect(backupReminderDue({ ...base, firstAnswerDay: '2026-01-01', lastExportAt: NOW - 7 * DAY })).toBe(false);
    expect(backupReminderDue({ ...base, firstAnswerDay: '2026-01-01', lastExportAt: NOW - 7 * DAY - 1 })).toBe(true);
    expect(backupReminderDue({ ...base, lastExportAt: NOW - DAY })).toBe(false);
  });

  it('"Kapat" hides it for 7 days, then it comes back', () => {
    const old = { ...base, lastExportAt: NOW - 30 * DAY };
    expect(backupReminderDue({ ...old, dismissedAt: NOW - 6 * DAY })).toBe(false);
    expect(backupReminderDue({ ...old, dismissedAt: NOW - 7 * DAY })).toBe(true);
  });
});
