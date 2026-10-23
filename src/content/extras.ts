// Query helpers over the extras bundle ('@extras' alias, see vite.config.ts).
import bundle from '@extras';
import type { AreaId } from '../domain/areas.ts';
import type { DiagnosticQuestion, ExtrasBundle, Topic } from '../domain/extrasSchema.ts';

// The ambient '@extras' declaration cannot resolve relative imports, so it types as any; re-type here.
const extras: ExtrasBundle = bundle;

/** The first topic that lists the item (an item in several topics links to the first). */
export const topicForItem = (itemId: string): Topic | undefined => extras.topics.find((t) => t.itemIds.includes(itemId));

export const questionsByArea = (area: AreaId): DiagnosticQuestion[] => extras.diagnostic.filter((q) => q.area === area);

export const topicsByArea = (area: AreaId): Topic[] => extras.topics.filter((t) => t.area === area);

export const topicById = (id: string): Topic | undefined => extras.topics.find((t) => t.id === id);
