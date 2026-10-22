// Catalog = bundled content + imported items (Slice 3), verified only.
import { acceptedSet } from '../domain/normalize.ts';
import type { ContentBundle, Item } from '../domain/types.ts';

export interface Catalog {
  contentVersion: string;
  /** Display order = file order (bundled), then imported items. */
  items: readonly Item[];
  byId: ReadonlyMap<string, Item>;
  /** Normalised accepted answers, computed once per item. */
  accepted: ReadonlyMap<string, ReadonlySet<string>>;
  /** Ids of bundled content: an imported item may never reuse one (07 §3.8). */
  builtinIds: ReadonlySet<string>;
  bundled: readonly Item[];
  imported: readonly Item[];
}

export function createCatalog(bundle: ContentBundle, imported: readonly Item[] = []): Catalog {
  const builtinIds = new Set(bundle.items.map((i) => i.id));
  // Defence in depth: the build ships verified items only, and an imported item never shadows bundled content.
  const bundled = bundle.items.filter((i) => i.verified === true);
  const own = imported.filter((i) => i.verified === true && !builtinIds.has(i.id));
  const items = [...bundled, ...own];
  return {
    contentVersion: bundle.contentVersion,
    items,
    byId: new Map(items.map((i) => [i.id, i])),
    accepted: new Map(items.map((i) => [i.id, acceptedSet(i.acceptedAnswers)])),
    builtinIds,
    bundled,
    imported: own,
  };
}

/** Catalog after an items import: same id → the new item replaces the old one. */
export function withImported(catalog: Catalog, incoming: readonly Item[]): Catalog {
  const byId = new Map(catalog.imported.map((i) => [i.id, i]));
  for (const i of incoming) byId.set(i.id, i);
  const c = createCatalog({ contentVersion: catalog.contentVersion, generatedAt: '', items: [...catalog.bundled] }, [...byId.values()]);
  return { ...c, builtinIds: catalog.builtinIds };
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
