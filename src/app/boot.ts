// Boot: open the DB, read everything into memory, build the catalog and
// resume the stored round; a new one starts from Home's "Başla" (07 §5.2, §3.6).
import type { Clock } from '../domain/clock.ts';
import { isSessionStale } from '../domain/session.ts';
import type { ContentBundle, SessionState } from '../domain/types.ts';
import { createCatalog, type Catalog } from '../content/catalog.ts';
import type { AppDb } from '../storage/db.ts';
import { clearSession, loadAll } from '../storage/repo.ts';
import { onShowableCard } from './round.ts';
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

/**
 * Resume the stored round with its full queue (same card, phase, draft,
 * repeats) unless it is stale (other day / > 12 h). A current card that left
 * the catalog or was flagged (decision 12) is skipped; undefined if no card
 * of the round is left.
 */
export function resumableSession(
  stored: SessionState | undefined,
  catalog: Catalog,
  clock: Clock,
  flags: ReadonlySet<string> = new Set(),
): SessionState | undefined {
  if (!stored || isSessionStale(stored, clock.today(), clock.now())) return undefined;
  const s = onShowableCard(stored, { catalog, flags });
  return s === 'round-end' ? undefined : s;
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
  return {
    db,
    // Always open on Home (05 §1): "Başla · bugün N", "Devam et" or "Bugün bitti".
    state: { screen: 'home', catalog, progress, flags, counter: data.counter, session: resumed },
  };
}
