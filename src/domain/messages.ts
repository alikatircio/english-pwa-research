// Message exercise (decisions 49, 59): which message a free-practice round may end with.
import type { Message } from './extrasSchema.ts';
import type { Item, Progress } from './types.ts';

export const MESSAGE_MIN_BOX = 4;

interface EligibilityPools {
  items: ReadonlyMap<string, Item>;
  progress: ReadonlyMap<string, Progress>;
  flaggedIds: ReadonlySet<string>;
}

/** Every blank's item is in the catalog, not flagged (suspended) and at box >= 4. */
export function isMessageEligible(m: Message, p: EligibilityPools): boolean {
  return (
    m.blanks.length > 0 &&
    m.blanks.every(({ itemId }) => p.items.has(itemId) && !p.flaggedIds.has(itemId) && (p.progress.get(itemId)?.box ?? 0) >= MESSAGE_MIN_BOX)
  );
}

/** Least recently practised eligible message (never practised first), then file order. `lastAt` = newest answer-log `at` per messageId. */
export function pickMessage(messages: readonly Message[], p: EligibilityPools, lastAt: ReadonlyMap<string, number> = new Map()): Message | undefined {
  let best: Message | undefined;
  for (const m of messages) {
    if (!isMessageEligible(m, p)) continue;
    if (!best || (lastAt.get(m.id) ?? -1) < (lastAt.get(best.id) ?? -1)) best = m;
  }
  return best;
}
