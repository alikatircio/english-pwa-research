// First run and the backup reminder (T5.5, decision 27). Pure: no IDB, no DOM.
import { addDays, compareDays } from './dates.ts';
import type { DayKey, Progress } from './types.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Decision 27: remind when the last backup is older than a week; "Kapat" hides it for a week. */
export const BACKUP_REMINDER_DAYS = 7;
const WEEK_MS = BACKUP_REMINDER_DAYS * DAY_MS;

/**
 * The first-run welcome shows while the device has never started (no
 * `firstRunAt`) and holds nothing of the user's: no progress, notebook or
 * imported items.
 */
export function isFirstRun(s: { firstRunAt: number | undefined; progress: number; notebook: number; imported: number }): boolean {
  return s.firstRunAt === undefined && s.progress === 0 && s.notebook === 0 && s.imported === 0;
}

/** Day of the very first answer on this device: the earliest `introducedOn`. */
export function firstAnswerDay(progress: Iterable<Progress>): DayKey | undefined {
  let first: DayKey | undefined;
  for (const p of progress) if (first === undefined || compareDays(p.introducedOn, first) < 0) first = p.introducedOn;
  return first;
}

export interface BackupReminderInput {
  now: number;
  today: DayKey;
  lastExportAt: number | undefined;
  /** No export yet: the reminder starts a week after the first answer. */
  firstAnswerDay: DayKey | undefined;
  dismissedAt: number | undefined;
}

/**
 * "Yedeğin 1 haftadan eski" on Home: the last export is more than 7 days old,
 * or there was none and the first answer is more than 7 days old. Hidden for
 * 7 days after "Kapat".
 */
export function backupReminderDue({ now, today, lastExportAt, firstAnswerDay: first, dismissedAt }: BackupReminderInput): boolean {
  if (dismissedAt !== undefined && now - dismissedAt < WEEK_MS) return false;
  if (lastExportAt !== undefined) return now - lastExportAt > WEEK_MS;
  if (first === undefined) return false;
  return compareDays(today, addDays(first, BACKUP_REMINDER_DAYS)) > 0;
}
