// Glue between in-memory app state and the pure round builder (07 §3.6).
import type { Clock } from '../domain/clock.ts';
import { advance, buildRound, currentEntry, newSession, type Pools } from '../domain/session.ts';
import type { DailyCounter, SessionState } from '../domain/types.ts';
import { newOrder, type Catalog } from '../content/catalog.ts';
import type { ReadyState } from './state.ts';

type PoolSource = Pick<ReadyState, 'catalog' | 'progress' | 'flags'>;
type ShowSource = Pick<ReadyState, 'catalog' | 'flags'>;

/** newOrder per catalog, computed once (a catalog only changes on import). */
const orderCache = new WeakMap<Catalog, readonly string[]>();
function cachedOrder(catalog: Catalog): readonly string[] {
  let order = orderCache.get(catalog);
  if (!order) {
    order = newOrder(catalog);
    orderCache.set(catalog, order);
  }
  return order;
}

/** Pools for the day `counter` belongs to. */
export function poolsOf(s: PoolSource, counter: DailyCounter): Pools {
  return { items: s.catalog.byId, progress: s.progress, flaggedIds: s.flags, counter, newOrder: cachedOrder(s.catalog) };
}

/** A new round for `counter.day` (today), or undefined when nothing is left today ("Bugün bitti"). */
export function freshRound(s: PoolSource, counter: DailyCounter, clock: Clock): SessionState | undefined {
  const queue = buildRound(poolsOf(s, counter), counter.day);
  return queue.length > 0 ? newSession(queue, counter.day, clock.now()) : undefined;
}

/** A card can be shown if it is still in the catalog and not flagged (decision 12). */
export function isShowable(s: ShowSource, itemId: string): boolean {
  return s.catalog.byId.has(itemId) && !s.flags.has(itemId);
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
