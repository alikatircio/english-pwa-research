// Leitner scheduling (decisions 2–4, 39; 01 §4b; 07 §3.4).
// In-round re-asks and free practice never call applyGrade (decisions 38, 41).
import { addDays, compareDays } from './dates.ts';
import type { Box, DayKey, Grade, Progress } from './types.ts';

/** Days until the next review for a card that lands in each box. */
export const INTERVALS: Readonly<Record<Box, number>> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 35, 7: 80 };

function nextBox(prev: Box | null, grade: Grade): Box {
  if (grade === 'wrong') return 1;
  if (grade === 'partial') return prev ?? 1;
  // correct: a new card counts as box 1 → box 2.
  return Math.min((prev ?? 1) + 1, 7) as Box;
}

export function applyGrade(prev: Progress | null, grade: Grade, itemId: string, today: DayKey, now: number): Progress {
  const box = nextBox(prev?.box ?? null, grade);
  const days = grade === 'correct' ? INTERVALS[box] : 1;
  return {
    itemId,
    box,
    dueOn: addDays(today, days),
    introducedOn: prev?.introducedOn ?? today,
    lastAnsweredOn: today,
    lastGrade: grade,
    updatedAt: now,
    shows: (prev ? (prev.shows ?? 1) : 0) + 1,
  };
}

/** Due on/after dueOn. A card answered "in the future" (clock moved back) is treated as due (03 §4.5). */
export function isDue(p: Progress, today: DayKey): boolean {
  return compareDays(p.dueOn, today) <= 0 || compareDays(p.lastAnsweredOn, today) > 0;
}
