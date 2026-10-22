import type { Page } from '@playwright/test';
import { addDays } from '../../../src/domain/dates.ts';
import type { DayKey } from '../../../src/domain/types.ts';

/** Day 0 of the clock-controlled specs (07 §7.3). */
export const DAY0: DayKey = '2026-11-02';

/** Local day `n` days after DAY0. */
export const day = (n: number): DayKey => addDays(DAY0, n);

/** ISO local timestamp on day `n` (for `App.open` / `page.clock.install`). */
export const at = (n: number, time = '08:00:00'): string => `${day(n)}T${time}`;

/** Move the installed fake clock to day `n` without reloading (a round that crosses midnight). */
export async function setDay(page: Page, n: number, time = '08:00:00'): Promise<void> {
  await page.clock.setSystemTime(new Date(at(n, time)));
}

/** Reopen the app on day `n`: move the clock, then reload (lands on Home). */
export async function reopenOnDay(page: Page, n: number, time = '08:00:00'): Promise<void> {
  await setDay(page, n, time);
  await page.reload();
}
