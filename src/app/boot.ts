// Boot: open the DB, read everything into memory, build the catalog and the
// Slice 1 session (07 §5.2).
import type { Clock } from '../domain/clock.ts';
import { currentEntry, isSessionStale, newSession } from '../domain/session.ts';
import type { ContentBundle, Progress, SessionState } from '../domain/types.ts';
import { createCatalog, temporaryOrder, type Catalog } from '../content/catalog.ts';
import type { AppDb } from '../storage/db.ts';
import { clearSession, loadAll } from '../storage/repo.ts';
import type { ReadyState } from './state.ts';

export interface BootDeps {
  bundle: ContentBundle;
  clock: Clock;
  openDb: () => Promise<AppDb>;
}

export interface BootResult {
  db: AppDb;
  state: Omit<ReadyState, 'status' | 'busy'>;
}

/** Slice 1: queue every not-yet-answered item (temporary order, T1.7). */
export function freshSession(catalog: Catalog, progress: ReadonlyMap<string, Progress>, flags: ReadonlySet<string>, clock: Clock): SessionState | undefined {
  const ids = temporaryOrder(catalog, progress, flags);
  if (ids.length === 0) return undefined;
  return newSession(ids.map((itemId) => ({ itemId, kind: 'new' as const })), clock.today(), clock.now());
}

/**
 * Resume the stored session as-is (same card, phase and draft) unless it is
 * stale (other day / > 12 h) or points at an item no longer in the catalog
 * or flagged (decision 12: a flagged card is not shown again).
 */
export function resumableSession(
  stored: SessionState | undefined,
  catalog: Catalog,
  clock: Clock,
  flags: ReadonlySet<string> = new Set(),
): SessionState | undefined {
  if (!stored || isSessionStale(stored, clock.today(), clock.now())) return undefined;
  const entry = currentEntry(stored);
  return entry && catalog.byId.has(entry.itemId) && !flags.has(entry.itemId) ? stored : undefined;
}

export async function boot({ bundle, clock, openDb }: BootDeps): Promise<BootResult> {
  const db = await openDb();
  const today = clock.today();
  const data = await loadAll(db, today);
  const catalog = createCatalog(bundle, data.importedItems);
  const progress = new Map(data.progress.map((p) => [p.itemId, p]));
  const flags = new Set(data.flags.map((f) => f.itemId));
  const resumed = resumableSession(data.session, catalog, clock, flags);
  if (data.session && !resumed) await clearSession(db); // dropped silently (02 §3)
  const session = resumed ?? freshSession(catalog, progress, flags, clock);
  return {
    db,
    state: { screen: session ? 'card' : 'done', catalog, progress, flags, counter: data.counter, session },
  };
}
