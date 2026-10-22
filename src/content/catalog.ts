// Catalog = bundled content (+ imported items later, Slice 3), verified only.
import { acceptedSet } from '../domain/normalize.ts';
import type { ContentBundle, Item } from '../domain/types.ts';

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
 * New-card order (07 §3.6, decision 3): notebook (user-error) items first,
 * then level ascending, then catalog order. Pools filter answered/flagged ids.
 */
export function newOrder(catalog: Catalog): string[] {
  const rank = (i: Item) => (i.source === 'user-error' ? 0 : 1);
  // Array.prototype.sort is stable, so equal keys keep catalog order.
  return [...catalog.items].sort((a, b) => rank(a) - rank(b) || a.level - b.level).map((i) => i.id);
}
