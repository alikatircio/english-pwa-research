// Round/session logic (07 §3.6; decisions 1–3, 5, 6, 12, 25; 05 §1).
// Pure: the caller injects `today` (from a Clock) and `now`.
import { compareDays } from './dates.ts';
import { isDue } from './scheduler.ts';
import type { DailyCounter, DayKey, Grade, Item, Progress, QueueEntry, QueueKind, SessionState } from './types.ts';

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

/** A card can be shown if it is in the catalog and not flagged (decision 12). The one rule for rounds and Home counts. */
export function isShowable(p: Pick<Pools, 'items' | 'flaggedIds'>, itemId: string): boolean {
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

/** 02 §3: a session older than 12 hours is dropped silently. */
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Stale if the queue was built on another day (03 §4.5) or last touched more than 12 h ago. */
export function isSessionStale(s: SessionState, today: DayKey, now: number): boolean {
  return s.day !== today || now - s.updatedAt > SESSION_MAX_AGE_MS;
}

/**
 * Session effects of the first grade given to the current card.
 * - Main card graded wrong/partial → appended once as `repeat` (decision 5).
 * - `consecutiveWrong` counts wrong main-card answers; correct/partial reset it
 *   (decision 25). On reaching BREATHER_AFTER, the highest-box remaining main
 *   card (new = box 0; ties keep queue order) moves to cursor+1 and the
 *   counter resets (decision 6).
 * - A repeat answer changes none of that (and never touches the box).
 * The card's targetChunk is recorded once for the round-end summary (05 §3).
 */
export function onFirstAnswer(s: SessionState, grade: Grade, pools: Pools): SessionState {
  const entry = currentEntry(s);
  if (!entry) return s;

  const chunk = pools.items.get(entry.itemId)?.targetChunk;
  const studiedChunks =
    chunk !== undefined && !s.studiedChunks.includes(chunk) ? [...s.studiedChunks, chunk] : s.studiedChunks;
  if (entry.kind === 'repeat') return { ...s, studiedChunks };

  let queue = s.queue;
  let repeatQueued = s.repeatQueued;
  if (grade !== 'correct' && !repeatQueued.includes(entry.itemId)) {
    queue = [...queue, { itemId: entry.itemId, kind: 'repeat' }];
    repeatQueued = [...repeatQueued, entry.itemId];
  }

  let consecutiveWrong = grade === 'wrong' ? s.consecutiveWrong + 1 : 0;
  if (consecutiveWrong >= BREATHER_AFTER) {
    queue = pullBreather(queue, s.cursor, pools);
    consecutiveWrong = 0;
  }

  return { ...s, queue, repeatQueued, consecutiveWrong, studiedChunks };
}

function pullBreather(queue: readonly QueueEntry[], cursor: number, pools: Pools): QueueEntry[] {
  let pick = -1;
  let best = -1;
  for (let i = cursor + 1; i < queue.length; i++) {
    const e = queue[i];
    if (!e || e.kind === 'repeat') continue;
    const box = pools.progress.get(e.itemId)?.box ?? 0;
    if (box > best) {
      best = box;
      pick = i;
    }
  }
  const next = [...queue];
  if (pick > cursor + 1) next.splice(cursor + 1, 0, ...next.splice(pick, 1));
  return next;
}

/** Next card, or 'round-end' after the last one. Resets phase and draft, drops the undo snapshot. */
export function advance(s: SessionState): SessionState | 'round-end' {
  const cursor = s.cursor + 1;
  if (cursor >= s.queue.length) return 'round-end';
  const next: SessionState = { ...s, cursor, phase: { tag: 'question' }, draft: '' };
  delete next.undo;
  return next;
}

export function emptyCounter(day: DayKey): DailyCounter {
  return { day, newIntroduced: 0, reviewsAnswered: 0 };
}

/**
 * Daily counter after a first answer of a `kind` card. Counts go to the day the
 * queue was built (03 §4.5), so pass the counter for `sessionDay`; repeats are
 * not counted.
 */
export function countFirstAnswer(counter: DailyCounter, kind: QueueKind, sessionDay: DayKey): DailyCounter {
  if (counter.day !== sessionDay) {
    throw new Error(`Counter day ${counter.day} does not match session day ${sessionDay}`);
  }
  if (kind === 'new') return { ...counter, newIntroduced: counter.newIntroduced + 1 };
  if (kind === 'due') return { ...counter, reviewsAnswered: counter.reviewsAnswered + 1 };
  return counter;
}
