// Catalog = bundled content (+ imported items later, Slice 3), verified only.
import { acceptedSet } from '../domain/normalize.ts';
import type { ContentBundle, Item, Progress } from '../domain/types.ts';

export interface Catalog {
  contentVersion: string;
  /** Display order = file order. */
  items: readonly Item[];
  byId: ReadonlyMap<string, Item>;
  /** Normalised accepted answers, computed once per item. */
  accepted: ReadonlyMap<string, ReadonlySet<string>>;
}

export function createCatalog(bundle: ContentBundle, imported: readonly Item[] = []): Catalog {
  // Defence in depth: the build already ships verified items only.
  const items = [...bundle.items, ...imported].filter((i) => i.verified === true);
  return {
    contentVersion: bundle.contentVersion,
    items,
    byId: new Map(items.map((i) => [i.id, i])),
    accepted: new Map(items.map((i) => [i.id, acceptedSet(i.acceptedAnswers)])),
  };
}

/**
 * Slice 1 first-ten selection: the ten items 04-learning-design §4 recommends
 * for the first slice (#1, #5, #7, #8, #9, #15, #16, #17, #23, #29), all
 * verified. Ids missing from the catalog (e.g. the e2e fixture) are skipped.
 * Replaced by the real round builder in Slice 4 (T4.4).
 */
export const SLICE1_FIRST_IDS: readonly string[] = [
  'could-you-base-verb',
  'i-agree-with-you',
  'explain-something-to-someone',
  'discuss-something',
  'remind-someone-to',
  'depend-on',
  'responsible-for',
  'wait-for',
  'reproduce-the-issue',
  'data-uncountable',
];

/**
 * Temporary Slice 1 order (T1.7): not-yet-answered items, the Slice 1 ten
 * first, then the rest in file order. Flagged items are left out.
 */
export function temporaryOrder(
  catalog: Catalog,
  progress: ReadonlyMap<string, Progress>,
  flagged: ReadonlySet<string> = new Set(),
): string[] {
  const open = (id: string) => catalog.byId.has(id) && !progress.has(id) && !flagged.has(id);
  const first = SLICE1_FIRST_IDS.filter(open);
  const firstSet = new Set(first);
  const rest = catalog.items.map((i) => i.id).filter((id) => open(id) && !firstSet.has(id));
  return [...first, ...rest];
}
