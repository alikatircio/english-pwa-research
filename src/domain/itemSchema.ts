import { z } from 'zod';
import type { Item } from './types.ts';

export const CATEGORIES = ['aux_to', 'object', 'word_form', 'preposition', 'work_vocab'] as const;

/** kebab-case: lowercase ASCII letters/digits separated by single hyphens. */
export const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const text = z.string().trim().min(1);

/**
 * Item schema (06 final schema). Strict: unknown keys are rejected so a typo
 * in a draft (e.g. `acceptedAnswer`) fails the content build instead of
 * silently dropping data. Count rules (3–8 answers etc.) live in the content
 * checks (C3), not here, so runtime imports can report them separately.
 */
export const ItemSchema: z.ZodType<Item> = z.strictObject({
  id: z.string().regex(KEBAB_CASE, 'id must be kebab-case'),
  category: z.enum(CATEGORIES),
  targetChunk: text,
  patternSlots: text.optional(),
  clozeTemplate: text,
  situationTr: text,
  acceptedAnswers: z.array(text).min(1),
  modelSentences: z.array(text).min(1),
  commonMistake: text.optional(),
  checklistTr: z.array(text).min(1).max(3),
  noteTr: text,
  source: z.enum(['curated', 'user-error']),
  verified: z.boolean(),
  verifiedNote: text.optional(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  notebookId: text.optional(),
});

export function parseItem(input: unknown): Item {
  return ItemSchema.parse(input);
}
