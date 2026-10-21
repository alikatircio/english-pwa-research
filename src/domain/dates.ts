import type { DayKey } from './types.ts';

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export function isDayKey(value: string): boolean {
  const m = DAY_KEY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Calendar arithmetic on the day itself; UTC is used only as a neutral grid, so DST never shifts a day. */
function toUtcMs(day: DayKey): number {
  if (!isDayKey(day)) throw new Error(`Invalid DayKey: ${day}`);
  const [y, mo, d] = day.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, mo - 1, d);
}

function fromUtcMs(ms: number): DayKey {
  const date = new Date(ms);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

export function addDays(day: DayKey, n: number): DayKey {
  return fromUtcMs(toUtcMs(day) + n * MS_PER_DAY);
}

/** Negative if a < b, 0 if equal, positive if a > b. */
export function compareDays(a: DayKey, b: DayKey): number {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / MS_PER_DAY);
}

/** Device-local calendar day of an epoch timestamp. */
export function toDayKey(epochMs: number): DayKey {
  const date = new Date(epochMs);
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}
