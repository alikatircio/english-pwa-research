import { z } from 'zod';
import { AREA_IDS, type AreaId } from './areas.ts';
import { CATEGORIES, KEBAB_CASE } from './itemSchema.ts';

const text = z.string().trim().min(1);
const kebab = z.string().regex(KEBAB_CASE, 'id must be kebab-case');
const area = z.enum(AREA_IDS as [AreaId, ...AreaId[]]);

const BookRefSchema = z
  .strictObject({ book: z.enum(['Gram', 'Coll']), unit: z.number().int().min(1) })
  .refine((r) => r.unit <= (r.book === 'Gram' ? 145 : 60), 'unit out of range (Gram 1–145, Coll 1–60)');

/** diagnostic-*.verified.json record (§1.3). Count and content rules live in scripts/extras-checks.ts (C16). */
export const DiagnosticQuestionSchema = z.strictObject({
  id: kebab.refine((s) => s.startsWith('dq-'), 'id must start with dq-'),
  area,
  category: z.enum(CATEGORIES),
  refs: z.array(BookRefSchema),
  relatedItemIds: z.array(kebab),
  promptTr: text,
  stem: text,
  options: z.array(z.strictObject({ id: z.enum(['a', 'b', 'c', 'd']), text })),
  correct: z.array(z.enum(['a', 'b', 'c', 'd'])),
  explanationTr: text,
  verified: z.boolean(),
  verifiedNote: text,
});

/** topics-*.verified.json record (§1.4). Rules: C17. */
export const TopicSchema = z.strictObject({
  id: kebab,
  area,
  titleTr: text,
  summaryTr: text,
  sections: z.array(
    z.strictObject({
      headingTr: text,
      bodyTr: z.array(text),
      examples: z.array(z.strictObject({ en: text, tr: text })),
    }),
  ),
  itemIds: z.array(kebab),
  refs: z.array(BookRefSchema),
  verified: z.boolean(),
  verifiedNote: text,
});

/** messages-*.verified.json record (§1.5). Rules: C18. */
export const MessageSchema = z.strictObject({
  id: kebab.refine((s) => s.startsWith('msg-'), 'id must start with msg-'),
  channel: z.enum(['teams', 'jira']),
  contextTr: text,
  text,
  blanked: text,
  blanks: z.array(z.strictObject({ itemId: kebab })),
  verified: z.boolean(),
  verifiedNote: text,
});

export type DiagnosticQuestion = z.infer<typeof DiagnosticQuestionSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type Message = z.infer<typeof MessageSchema>;

/** src/content/extras.json (or the e2e fixture). */
export interface ExtrasBundle {
  extrasVersion: string;
  diagnostic: DiagnosticQuestion[];
  topics: Topic[];
  messages: Message[];
}
