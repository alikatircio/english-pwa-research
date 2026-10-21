// Boot: open the DB, read everything into memory, build the catalog and the
// Slice 1 session (07 §5.2).
import type { Clock } from '../domain/clock.ts';
import { newSession } from '../domain/session.ts';
import type { ContentBundle, Progress, SessionState } from '../domain/types.ts';
import { createCatalog, temporaryOrder, type Catalog } from '../content/catalog.ts';
import type { AppDb } from '../storage/db.ts';
import { loadAll } from '../storage/repo.ts';
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

export async function boot({ bundle, clock, openDb }: BootDeps): Promise<BootResult> {
  const db = await openDb();
  const today = clock.today();
  const data = await loadAll(db, today);
  const catalog = createCatalog(bundle, data.importedItems);
  const progress = new Map(data.progress.map((p) => [p.itemId, p]));
  const flags = new Set(data.flags.map((f) => f.itemId));
  const session = freshSession(catalog, progress, flags, clock);
  return {
    db,
    state: { screen: session ? 'card' : 'done', catalog, progress, flags, counter: data.counter, session },
  };
}
