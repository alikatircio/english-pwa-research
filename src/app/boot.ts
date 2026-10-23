// Boot: open the DB, read everything into memory, build the catalog and
// resume the stored round; a new one starts from Home's "Başla" (07 §5.2, §3.6).
import type { Clock } from '../domain/clock.ts';
import { isSessionStale } from '../domain/session.ts';
import type { ContentBundle, SessionState } from '../domain/types.ts';
import { createCatalog, type Catalog } from '../content/catalog.ts';
import type { AppDb } from '../storage/db.ts';
import { clearSession, loadAll, loadDiagnosticAttempts, loadMessageLastAt, type LoadedData } from '../storage/repo.ts';
import { metaFromRecords } from './meta.ts';
import { latestFinished, priorityItems } from '../domain/priority.ts';
import type { ExtrasBundle } from '../domain/extrasSchema.ts';
import { onShowableCard } from './round.ts';
import type { ReadyState, Screen } from './state.ts';

export interface BootDeps {
  bundle: ContentBundle;
  clock: Clock;
  openDb: () => Promise<AppDb>;
  /** Diagnostic + topics, for the new-card priority (Phase 5). Default: none. */
  extras?: Pick<ExtrasBundle, 'diagnostic'> & Partial<Pick<ExtrasBundle, 'topics' | 'messages'>>;
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
  messages?: ExtrasBundle['messages'],
  progress?: ReadyState['progress'],
): SessionState | undefined {
  if (!stored || isSessionStale(stored, clock.today(), clock.now())) return undefined;
  const s = onShowableCard(stored, { catalog, flags, messages, progress });
  return s === 'round-end' ? undefined : s;
}

/**
 * In-memory state from what is on disk (boot, and again after a backup
 * restore). A stored round that can no longer be resumed is cleared.
 */
export async function loadReadyState(
  db: AppDb,
  catalogOf: (imported: LoadedData['importedItems']) => Catalog,
  clock: Clock,
  screen: Screen,
  extras: BootDeps['extras'] = { diagnostic: [] },
): Promise<BootResult['state']> {
  const data = await loadAll(db, clock.today());
  // Attempts are read separately from loadAll (roadmap 2.3).
  const attempts = await loadDiagnosticAttempts(db);
  const catalog = catalogOf(data.importedItems);
  const progress = new Map(data.progress.map((p) => [p.itemId, p]));
  const flags = new Set(data.flags.map((f) => f.itemId));
  const resumed = resumableSession(data.session, catalog, clock, flags, extras.messages, progress);
  if (data.session && !resumed) await clearSession(db); // dropped silently (02 §3)
  return {
    screen,
    catalog,
    progress,
    flags,
    counter: data.counter,
    session: resumed,
    notebook: data.notebook,
    meta: metaFromRecords(data.meta),
    diagnostic: { attempts, open: attempts.findLast((a) => a.finishedAt === undefined) },
    newPriority: priorityItems(latestFinished(attempts), extras),
    messages: extras.messages,
    messageLastAt: await loadMessageLastAt(db),
  };
}

export async function boot({ bundle, clock, openDb, extras }: BootDeps): Promise<BootResult> {
  const db = await openDb();
  // Always open on Home (05 §1): "Başla · bugün N", "Devam et" or "Bugün bitti".
  const state = await loadReadyState(db, (imported) => createCatalog(bundle, imported), clock, 'home', extras);
  return { db, state };
}
