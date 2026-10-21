// Round/session logic (07 §3.6; decisions 1–3, 5, 6, 12, 25; 05 §1).
// Pure: the caller injects `today` (from a Clock) and `now`.
import { compareDays } from './dates.ts';
import { isDue } from './scheduler.ts';
import type { DailyCounter, DayKey, Item, Progress, QueueEntry, SessionState } from './types.ts';

/** Decision 1. */
export const ROUND_SIZE = 8;
/** Decision 3. */
export const DAILY_NEW_CAP = 5;
/** Decision 2. */
export const DAILY_DUE_CAP = 25;
/** Decision 6: consecutive wrong first answers before a breather card. */
export const BREATHER_AFTER = 3;

export interface Pools {
  /** Showable items: verified and present in the catalog. */
  items: ReadonlyMap<string, Item>;
  progress: ReadonlyMap<string, Progress>;
  /** Decision 12: flagged items are suspended. */
  flaggedIds: ReadonlySet<string>;
  /** Counter of the day being scheduled. */
  counter: DailyCounter;
  /** Notebook (user-error) items first, then level ascending, then file order. */
  newOrder: readonly string[];
}

function isShowable(p: Pools, itemId: string): boolean {
  return p.items.has(itemId) && !p.flaggedIds.has(itemId);
}

/** Due cards, ordered dueOn ↑, box ↑, itemId ↑. Uncapped. */
export function eligibleDue(p: Pools, today: DayKey): string[] {
  const due: Progress[] = [];
  for (const prog of p.progress.values()) {
    if (isShowable(p, prog.itemId) && isDue(prog, today)) due.push(prog);
  }
  due.sort(
    (a, b) =>
      compareDays(a.dueOn, b.dueOn) || a.box - b.box || (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0),
  );
  return due.map((d) => d.itemId);
}

/** New cards (no progress record) in `newOrder`. Uncapped. */
export function eligibleNew(p: Pools): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of p.newOrder) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (isShowable(p, id) && !p.progress.has(id)) out.push(id);
  }
  return out;
}

function budgets(p: Pools): { due: number; new: number } {
  return {
    due: Math.max(0, DAILY_DUE_CAP - p.counter.reviewsAnswered),
    new: Math.max(0, DAILY_NEW_CAP - p.counter.newIntroduced),
  };
}

interface Selection {
  due: string[];
  fresh: string[];
}

/**
 * Today's remaining cards. New cards are offered only when every due card fits
 * in today's due budget, so a backlog larger than the budget blocks new cards
 * (decision 2) and due cards always come first.
 */
function select(p: Pools, today: DayKey): Selection {
  const b = budgets(p);
  const allDue = eligibleDue(p, today);
  const due = allDue.slice(0, b.due);
  const fresh = allDue.length <= b.due ? eligibleNew(p).slice(0, b.new) : [];
  return { due, fresh };
}

/** The single number on the Home screen. */
export function todayCount(p: Pools, today: DayKey): number {
  const s = select(p, today);
  return s.due.length + s.fresh.length;
}

/**
 * Up to ROUND_SIZE cards: due first, then new. The opening card is the
 * highest-box due card (05 §1: likely correct); ties keep due order.
 * Empty → "Bugün bitti".
 */
export function buildRound(p: Pools, today: DayKey): QueueEntry[] {
  const s = select(p, today);
  const due = s.due.slice(0, ROUND_SIZE);
  const fresh = s.fresh.slice(0, ROUND_SIZE - due.length);

  let opener = -1;
  let best = 0;
  due.forEach((id, i) => {
    const box = p.progress.get(id)?.box ?? 0;
    if (box > best) {
      best = box;
      opener = i;
    }
  });
  if (opener > 0) due.unshift(...due.splice(opener, 1));

  return [
    ...due.map((itemId): QueueEntry => ({ itemId, kind: 'due' })),
    ...fresh.map((itemId): QueueEntry => ({ itemId, kind: 'new' })),
  ];
}

export function newSession(queue: readonly QueueEntry[], day: DayKey, now: number): SessionState {
  return {
    key: 'current',
    day,
    startedAt: now,
    updatedAt: now,
    queue: [...queue],
    cursor: 0,
    phase: { tag: 'question' },
    draft: '',
    repeatQueued: [],
    consecutiveWrong: 0,
    studiedChunks: [],
  };
}

export function currentEntry(s: SessionState): QueueEntry | undefined {
  return s.queue[s.cursor];
}
