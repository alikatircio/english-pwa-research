// Checks for the side content (12-pdf-roadmap §1.3–§1.5): C16 diagnostic, C17 topics, C18 messages.
// Pure; the build script decides what to do with the findings. C8–C10 (privacy) are reused
// through checkTextPrivacy.
import { AREA_IDS } from '../src/domain/areas.ts';
import { blankAnswers, BLANK_TOKEN } from '../src/domain/blankAnswers.ts';
import {
  DiagnosticQuestionSchema,
  MessageSchema,
  TopicSchema,
  type DiagnosticQuestion,
  type Message,
  type Topic,
} from '../src/domain/extrasSchema.ts';
import { normalizeAnswer } from '../src/domain/normalize.ts';
import type { Item } from '../src/domain/types.ts';
import { type DraftFile, type Finding } from './content-checks.ts';

export type ExtrasCheckId = 'C16' | 'C17' | 'C18';
export type ExtrasFinding = Omit<Finding, 'check'> & { check: Finding['check'] | ExtrasCheckId };
type ItemCheck = (item: Item) => Finding[];

/** What the checks need to know about shipped items. */
export type ShippedItem = Pick<Item, 'id' | 'acceptedAnswers'>;

export interface PrivacyChecks {
  /** C8/C9: run on a flat object holding every text field. */
  text: ItemCheck[];
  /** C10: run on an object with the text fields as modelSentences. */
  names?: ItemCheck;
}

const blankCount = (s: string): number => s.split(BLANK_TOKEN).length - 1;

/** C8–C10 over arbitrary labelled text fields, by reusing the item checks. */
export function checkTextPrivacy(id: string, fields: ReadonlyArray<[field: string, value: string]>, checks: PrivacyChecks): Finding[] {
  const flat = { id, ...Object.fromEntries(fields) } as unknown as Item;
  const out = checks.text.flatMap((c) => c(flat));
  if (checks.names) {
    const named = { id, situationTr: '', modelSentences: fields.filter(([f]) => f !== 'verifiedNote').map(([, v]) => v) } as unknown as Item;
    out.push(...checks.names(named));
  }
  return out;
}

function parseFiles<T extends { id: string }>(
  files: readonly DraftFile[],
  check: ExtrasCheckId,
  schema: { safeParse: (x: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } } },
  findings: ExtrasFinding[],
): T[] {
  const out: T[] = [];
  for (const { file, raw } of files) {
    if (!Array.isArray(raw)) {
      findings.push({ check, severity: 'error', file, message: 'draft file must be a JSON array' });
      continue;
    }
    raw.forEach((entry: unknown, index) => {
      const r = schema.safeParse(entry);
      if (r.success) out.push(r.data);
      else {
        const issues = r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
        const id = entry && typeof entry === 'object' && 'id' in entry && typeof entry.id === 'string' ? entry.id : undefined;
        findings.push({ check, severity: 'error', file, message: `record #${index}: ${issues}`, ...(id ? { itemId: id } : {}) });
      }
    });
  }
  return out;
}

function checkUniqueIds(records: ReadonlyArray<{ id: string }>, check: ExtrasCheckId): ExtrasFinding[] {
  const seen = new Set<string>();
  return records.flatMap(({ id }) => {
    const dup = seen.has(id);
    seen.add(id);
    return dup ? [{ check, severity: 'error' as const, itemId: id, message: 'duplicate id' }] : [];
  });
}

/** C16 rules for one question (the rest is schema + set rules). */
export function checkQuestion(q: DiagnosticQuestion, itemIds: ReadonlySet<string>): ExtrasFinding[] {
  const f: ExtrasFinding[] = [];
  const err = (message: string) => f.push({ check: 'C16', severity: 'error', itemId: q.id, message });
  const n = q.options.length;
  if (n < 3 || n > 4) err(`options must have 3–4 entries (has ${n})`);
  const ids = q.options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) err('option ids must be unique');
  const texts = q.options.map((o) => normalizeAnswer(o.text));
  if (new Set(texts).size !== texts.length) err('option texts must be unique after normalisation');
  if (q.correct.length < 1 || q.correct.length > n - 1) err(`correct must have 1–${n - 1} entries (has ${q.correct.length})`);
  if (new Set(q.correct).size !== q.correct.length) err('correct ids must be unique');
  for (const c of q.correct) if (!ids.includes(c)) err(`correct "${c}" is not an option id`);
  if (blankCount(q.stem) > 1) err('stem may contain at most one ___');
  if (q.relatedItemIds.length === 0) f.push({ check: 'C16', severity: 'warning', itemId: q.id, message: 'relatedItemIds is empty' });
  for (const id of q.relatedItemIds) if (!itemIds.has(id)) err(`relatedItemIds: "${id}" is not a shipped item`);
  return f;
}

/** C16: the shipped set is empty or exactly 3 questions in each of the 16 areas. */
export function checkDiagnosticSet(shipped: readonly DiagnosticQuestion[]): ExtrasFinding[] {
  if (shipped.length === 0) return [];
  const wrong = AREA_IDS.filter((a) => shipped.filter((q) => q.area === a).length !== 3);
  const expected = AREA_IDS.length * 3;
  return shipped.length === expected && wrong.length === 0
    ? []
    : [{ check: 'C16', severity: 'error', message: `shipped diagnostic set must be 0 or exactly ${expected} questions (3 per area); has ${shipped.length}${wrong.length ? `, areas off: ${wrong.join(', ')}` : ''}` }];
}

/** C17 rules for one topic. */
export function checkTopic(t: Topic, itemIds: ReadonlySet<string>): ExtrasFinding[] {
  const f: ExtrasFinding[] = [];
  const err = (message: string) => f.push({ check: 'C17', severity: 'error', itemId: t.id, message });
  if (t.sections.length < 1 || t.sections.length > 4) err(`sections must have 1–4 entries (has ${t.sections.length})`);
  t.sections.forEach((s, i) => {
    if (s.bodyTr.length < 1 || s.bodyTr.length > 3) err(`sections[${i}].bodyTr must have 1–3 paragraphs (has ${s.bodyTr.length})`);
    if (s.examples.length < 1 || s.examples.length > 4) err(`sections[${i}].examples must have 1–4 entries (has ${s.examples.length})`);
  });
  for (const id of t.itemIds) if (!itemIds.has(id)) err(`itemIds: "${id}" is not a shipped item`);
  return f;
}

/** C17 (warning): an item listed in more than one shipped topic links to the first. */
export function checkTopicOverlap(shipped: readonly Topic[]): ExtrasFinding[] {
  const first = new Map<string, string>();
  const f: ExtrasFinding[] = [];
  for (const t of shipped) {
    for (const id of new Set(t.itemIds)) {
      const prev = first.get(id);
      if (prev === undefined) first.set(id, t.id);
      else f.push({ check: 'C17', severity: 'warning', itemId: t.id, message: `item "${id}" is also in topic "${prev}"` });
    }
  }
  return f;
}

/** C18 rules for one message. */
export function checkMessage(m: Message, items: ReadonlyMap<string, ShippedItem>): ExtrasFinding[] {
  const f: ExtrasFinding[] = [];
  const err = (message: string) => f.push({ check: 'C18', severity: 'error', itemId: m.id, message });
  const n = m.blanks.length;
  if (n < 3 || n > 5) err(`blanks must have 3–5 entries (has ${n})`);
  const count = blankCount(m.blanked);
  if (count !== n) err(`blanked has ${count} ___, blanks has ${n}`);
  const answers = blankAnswers(m.blanked, m.text);
  if (answers === null) {
    err('blankAnswers(blanked, text) fails: blanked is not a blanked version of text');
    return f;
  }
  m.blanks.forEach((b, i) => {
    const item = items.get(b.itemId);
    if (!item) return err(`blanks[${i}]: "${b.itemId}" is not a shipped item`);
    const words = new Set(normalizeAnswer(item.acceptedAnswers[0] ?? '').split(' '));
    const missing = normalizeAnswer(answers[i] ?? '').split(' ').filter((w) => !words.has(w));
    if (missing.length > 0) err(`blanks[${i}]: "${answers[i]}" is not a word of "${b.itemId}" acceptedAnswers[0]`);
  });
  return f;
}

export interface ExtrasInput {
  diagnostic: readonly DraftFile[];
  topics: readonly DraftFile[];
  messages: readonly DraftFile[];
}

export interface ExtrasResult {
  findings: ExtrasFinding[];
  diagnostic: DiagnosticQuestion[];
  topics: Topic[];
  messages: Message[];
}

const withNote = <T extends { id: string; verified: boolean; verifiedNote: string }>(r: T, check: ExtrasCheckId): ExtrasFinding[] =>
  r.verified && !r.verifiedNote.trim() ? [{ check, severity: 'error', itemId: r.id, message: 'verified:true requires a verifiedNote' }] : [];

/** Validate every record, ship only the verified ones. */
export function runExtrasChecks(input: ExtrasInput, shippedItems: readonly ShippedItem[], privacy: PrivacyChecks): ExtrasResult {
  const findings: ExtrasFinding[] = [];
  const items = new Map(shippedItems.map((i) => [i.id, i]));
  const itemIds = new Set(items.keys());

  const dq = parseFiles(input.diagnostic, 'C16', DiagnosticQuestionSchema, findings);
  const tp = parseFiles(input.topics, 'C17', TopicSchema, findings);
  const ms = parseFiles(input.messages, 'C18', MessageSchema, findings);

  findings.push(...checkUniqueIds(dq, 'C16'), ...checkUniqueIds(tp, 'C17'), ...checkUniqueIds(ms, 'C18'));
  for (const q of dq) {
    findings.push(...withNote(q, 'C16'), ...checkQuestion(q, itemIds));
    findings.push(...checkTextPrivacy(q.id, [['promptTr', q.promptTr], ['stem', q.stem], ...q.options.map((o, i): [string, string] => [`options[${i}]`, o.text]), ['explanationTr', q.explanationTr], ['verifiedNote', q.verifiedNote]], privacy));
  }
  for (const t of tp) {
    findings.push(...withNote(t, 'C17'), ...checkTopic(t, itemIds));
    findings.push(
      ...checkTextPrivacy(
        t.id,
        [
          ['titleTr', t.titleTr],
          ['summaryTr', t.summaryTr],
          ...t.sections.flatMap((s, i): Array<[string, string]> => [
            [`sections[${i}].headingTr`, s.headingTr],
            ...s.bodyTr.map((b, j): [string, string] => [`sections[${i}].bodyTr[${j}]`, b]),
            ...s.examples.flatMap((e, j): Array<[string, string]> => [[`sections[${i}].examples[${j}].en`, e.en], [`sections[${i}].examples[${j}].tr`, e.tr]]),
          ]),
          ['verifiedNote', t.verifiedNote],
        ],
        privacy,
      ),
    );
  }
  for (const m of ms) {
    findings.push(...withNote(m, 'C18'), ...checkMessage(m, items));
    findings.push(...checkTextPrivacy(m.id, [['contextTr', m.contextTr], ['text', m.text], ['blanked', m.blanked], ['verifiedNote', m.verifiedNote]], privacy));
  }

  const diagnostic = dq.filter((q) => q.verified);
  const topics = tp.filter((t) => t.verified);
  findings.push(...checkDiagnosticSet(diagnostic), ...checkTopicOverlap(topics));
  return { findings, diagnostic, topics, messages: ms.filter((m) => m.verified) };
}
