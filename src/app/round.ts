// Glue between in-memory app state and the pure round builder (07 §3.6).
import type { Clock } from '../domain/clock.ts';
import { advance, buildPracticeRound, buildRound, currentEntry, isShowable as isShowableIn, newSession, type Pools } from '../domain/session.ts';
import type { DailyCounter, SessionState } from '../domain/types.ts';
import { newOrder, type Catalog } from '../content/catalog.ts';
import type { ReadyState } from './state.ts';

type PoolSource = Pick<ReadyState, 'catalog' | 'progress' | 'flags' | 'meta'>;
type ShowSource = Pick<ReadyState, 'catalog' | 'flags'>;

/** newOrder per catalog and priority set, computed once (a catalog only changes on import). */
const orderCache = new WeakMap<Catalog, Map<string, readonly string[]>>();
export function cachedOrder(catalog: Catalog, priority?: ReadonlySet<string>): readonly string[] {
  let byKey = orderCache.get(catalog);
  if (!byKey) {
    byKey = new Map();
    orderCache.set(catalog, byKey);
  }
  const key = priority ? [...priority].sort().join('\n') : '';
  let order = byKey.get(key);
  if (!order) {
    order = newOrder(catalog, priority);
    byKey.set(key, order);
  }
  return order;
}

/** Pools for the day `counter` belongs to. */
export function poolsOf(s: PoolSource, counter: DailyCounter): Pools {
  return {
    items: s.catalog.byId,
    progress: s.progress,
    flaggedIds: s.flags,
    counter,
    newOrder: cachedOrder(s.catalog),
    newCap: s.meta.dailyNewCap,
  };
}

/** A new round for `counter.day` (today), or undefined when nothing is left today ("Bugün bitti"). */
export function freshRound(s: PoolSource, counter: DailyCounter, clock: Clock): SessionState | undefined {
  const queue = buildRound(poolsOf(s, counter), counter.day);
  return queue.length > 0 ? newSession(queue, counter.day, clock.now()) : undefined;
}

/** A free-practice round (decision 30) for `counter.day`, or undefined when nothing seen is eligible. */
export function practiceRound(s: PoolSource, counter: DailyCounter, clock: Clock): SessionState | undefined {
  const queue = buildPracticeRound(poolsOf(s, counter), counter.day);
  return queue.length > 0 ? newSession(queue, counter.day, clock.now()) : undefined;
}

/** domain isShowable on app state: still in the catalog and not flagged (decision 12). */
export function isShowable(s: ShowSource, itemId: string): boolean {
  return isShowableIn({ items: s.catalog.byId, flaggedIds: s.flags }, itemId);
}

/**
 * The session as-is if its current card is showable; otherwise moved forward to
 * the next showable card (fresh question, no draft). 'round-end' if none is left.
 */
export function onShowableCard(session: SessionState, s: ShowSource): SessionState | 'round-end' {
  let cur: SessionState | 'round-end' = session;
  for (;;) {
    if (cur === 'round-end') return cur;
    const entry = currentEntry(cur);
    if (entry && isShowable(s, entry.itemId)) return cur;
    cur = advance(cur);
  }
}

/** Next showable card after the current one, or 'round-end'. */
export function nextCard(session: SessionState, s: ShowSource): SessionState | 'round-end' {
  const moved = advance(session);
  return moved === 'round-end' ? moved : onShowableCard(moved, s);
}
