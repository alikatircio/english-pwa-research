// Pure content checks (07 §4). Each check returns findings; the build script
// decides what to do with them (any 'error' → exit 1).
// Imports the app's own schema and normaliser so the build and the app agree.
import { ItemSchema, KEBAB_CASE } from '../src/domain/itemSchema.ts';
import { normalizeAnswer } from '../src/domain/normalize.ts';
import type { Category, Item } from '../src/domain/types.ts';

export type Severity = 'error' | 'warning' | 'info';
export type CheckId = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8' | 'C9' | 'C10' | 'C11' | 'C12' | 'C13';

export interface Finding {
  check: CheckId;
  severity: Severity;
  message: string;
  itemId?: string;
  file?: string;
}

export interface DraftFile {
  file: string;
  raw: unknown;
}

const BLANK = '___';

function idOf(raw: unknown): string | undefined {
  if (raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string') return raw.id;
  return undefined;
}

/** C1: every draft item (verified or not) matches ItemSchema. Returns the parsed items. */
export function checkSchema(drafts: readonly DraftFile[]): { items: Item[]; findings: Finding[] } {
  const items: Item[] = [];
  const findings: Finding[] = [];
  for (const { file, raw } of drafts) {
    if (!Array.isArray(raw)) {
      findings.push({ check: 'C1', severity: 'error', file, message: 'draft file must be a JSON array of items' });
      continue;
    }
    raw.forEach((entry: unknown, index) => {
      const r = ItemSchema.safeParse(entry);
      if (r.success) {
        items.push(r.data);
      } else {
        const issues = r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
        const itemId = idOf(entry);
        findings.push({ check: 'C1', severity: 'error', file, message: `item #${index}: ${issues}`, ...(itemId ? { itemId } : {}) });
      }
    });
  }
  return { items, findings };
}

/** C2: ids are kebab-case and unique across all drafts. */
export function checkIds(items: readonly Item[]): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const { id } of items) {
    if (!KEBAB_CASE.test(id)) findings.push({ check: 'C2', severity: 'error', itemId: id, message: 'id is not kebab-case' });
    if (seen.has(id)) findings.push({ check: 'C2', severity: 'error', itemId: id, message: 'duplicate id' });
    seen.add(id);
  }
  return findings;
}

/** C3: list sizes and canonical answer = first model sentence. */
export function checkCounts(item: Item): Finding[] {
  const f: Finding[] = [];
  const err = (message: string) => f.push({ check: 'C3', severity: 'error', itemId: item.id, message });
  const n = item.acceptedAnswers.length;
  if (n < 3 || n > 8) err(`acceptedAnswers must have 3–8 entries (has ${n})`);
  if (item.acceptedAnswers[0] !== item.modelSentences[0]) err('acceptedAnswers[0] must equal modelSentences[0]');
  const m = item.modelSentences.length;
  if (m < 2 || m > 3) err(`modelSentences must have 2–3 entries (has ${m})`);
  const c = item.checklistTr.length;
  if (c < 1 || c > 3) err(`checklistTr must have 1–3 entries (has ${c})`);
  return f;
}

/** C4: the common mistake must never be an accepted answer. */
export function checkCommonMistake(item: Item): Finding[] {
  if (item.commonMistake === undefined) return [];
  const mistake = normalizeAnswer(item.commonMistake);
  return item.acceptedAnswers.some((a) => normalizeAnswer(a) === mistake)
    ? [{ check: 'C4', severity: 'error', itemId: item.id, message: `commonMistake "${item.commonMistake}" is in acceptedAnswers after normalisation` }]
    : [];
}

/** C5: cloze has a blank and lines up token-by-token with the canonical answer. */
export function checkCloze(item: Item): Finding[] {
  const err = (message: string): Finding[] => [{ check: 'C5', severity: 'error', itemId: item.id, message }];
  const cloze = item.clozeTemplate;
  if (!cloze.includes(BLANK)) return err('clozeTemplate has no ___ blank');
  const canonical = item.acceptedAnswers[0] ?? '';
  const ct = cloze.trim().split(/\s+/);
  const at = canonical.trim().split(/\s+/);
  if (ct.length !== at.length) return err(`clozeTemplate has ${ct.length} tokens, canonical answer has ${at.length}`);
  for (let i = 0; i < ct.length; i++) {
    const c = ct[i] ?? '';
    const a = at[i] ?? '';
    if (c.includes(BLANK)) continue;
    if (normalizeAnswer(c) !== normalizeAnswer(a)) return err(`token ${i + 1}: cloze "${c}" ≠ canonical "${a}"`);
  }
  return [];
}

/** C6 (warning): two variants that normalise to the same string are redundant. */
export function checkDuplicateVariants(item: Item): Finding[] {
  const seen = new Map<string, string>();
  const f: Finding[] = [];
  for (const a of item.acceptedAnswers) {
    const k = normalizeAnswer(a);
    const prev = seen.get(k);
    if (prev !== undefined) f.push({ check: 'C6', severity: 'warning', itemId: item.id, message: `"${a}" duplicates "${prev}" after normalisation` });
    else seen.set(k, a);
  }
  return f;
}

/** C7: verified items carry a verifiedNote. */
export function checkVerifiedNote(item: Item): Finding[] {
  return item.verified && !item.verifiedNote?.trim()
    ? [{ check: 'C7', severity: 'error', itemId: item.id, message: 'verified:true requires a verifiedNote' }]
    : [];
}

// --- Privacy (C8–C10). The repo is public: no real names, addresses or contacts. ---

/** Every text value of an item, labelled by field. */
export function textFields(item: Item): Array<[field: string, value: string]> {
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(item)) {
    if (typeof v === 'string') out.push([k, v]);
    else if (Array.isArray(v)) v.forEach((s, i) => typeof s === 'string' && out.push([`${k}[${i}]`, s]));
  }
  return out;
}

const PRIVACY_PATTERNS: ReadonlyArray<[label: string, re: RegExp]> = [
  ['e-mail address', /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/u],
  ['URL', /\bhttps?:\/\/|\bwww\./i],
  ['domain name', /\.(com|io|net|org|dev)\b/i],
  ['IP address', /\b\d{1,3}(?:\.\d{1,3}){3}\b/],
  // Phone-like: 7+ digits, optionally separated by spaces, dots, dashes or brackets.
  // (A plain "3+ digits" rule would flag ticket keys such as QA-123.)
  ['phone-like number', /(?:\+|\b)\d(?:[\s().-]*\d){6,}\b/],
];

/**
 * C8: contact/address patterns in any text field. verifiedNote is exempt: it
 * cites public sources (dictionaries, docs sites) and is not user-facing.
 */
export function checkPrivacyPatterns(item: Item): Finding[] {
  const f: Finding[] = [];
  for (const [field, value] of textFields(item)) {
    if (field === 'verifiedNote') continue;
    for (const [label, re] of PRIVACY_PATTERNS) {
      if (re.test(value)) f.push({ check: 'C8', severity: 'error', itemId: item.id, message: `${field}: looks like a ${label}` });
    }
  }
  return f;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Parse a denylist (file or env): one term per line, '#' comments and blanks ignored. */
/** True on CI runners (GitHub Actions sets CI=true). */
export function isCi(env: Readonly<Record<string, string | undefined>>): boolean {
  const v = env.CI?.trim().toLowerCase();
  return v !== undefined && v !== '' && v !== 'false' && v !== '0';
}

/**
 * C9 without any denylist: a warning locally, an error on CI, so a missing or
 * misnamed PRIVACY_DENYLIST secret cannot skip the real-name check silently (09 #10).
 */
export function missingDenylistFinding(env: Readonly<Record<string, string | undefined>>): Finding {
  return isCi(env)
    ? { check: 'C9', severity: 'error', message: 'no privacy denylist on CI: set the PRIVACY_DENYLIST secret (real-name check cannot be skipped)' }
    : { check: 'C9', severity: 'warning', message: 'no privacy denylist (local file or PRIVACY_DENYLIST); real-name check skipped' };
}

export function parseDenylist(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
}

/** C9: no denylisted term (case-insensitive, whole word) in any text field. */
export function makeDenylistCheck(terms: readonly string[]): (item: Item) => Finding[] {
  const res = terms.map((t) => [t, new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(t)}(?![\\p{L}\\p{N}])`, 'iu')] as const);
  return (item) => {
    const f: Finding[] = [];
    for (const [field, value] of textFields(item)) {
      for (const [, re] of res) {
        // The term itself is not printed: CI logs are public.
        if (re.test(value)) f.push({ check: 'C9', severity: 'error', itemId: item.id, message: `${field}: contains a denylisted term` });
      }
    }
    return f;
  };
}

export interface Allowlist {
  names: string[];
  terms: string[];
}

/**
 * C10 (warning): capitalised words in situationTr/modelSentences that are not
 * sentence-initial and not allowlisted are proper-noun candidates.
 */
export function makeProperNounCheck(allow: Allowlist): (item: Item) => Finding[] {
  const ok = new Set([...allow.names, ...allow.terms]);
  return (item) => {
    const f: Finding[] = [];
    const fields: Array<[string, string]> = [['situationTr', item.situationTr], ...item.modelSentences.map((s, i): [string, string] => [`modelSentences[${i}]`, s])];
    for (const [field, value] of fields) {
      for (const m of value.matchAll(/(?<![\p{L}\p{N}'’])\p{Lu}[\p{L}\p{N}]*/gu)) {
        const before = value.slice(0, m.index).trimEnd();
        if (before === '' || /[.?!:"“„(]$/.test(before)) continue; // sentence start
        if (!ok.has(m[0])) f.push({ check: 'C10', severity: 'warning', itemId: item.id, message: `${field}: "${m[0]}" may be a real name; add it to privacy-allowlist.json if fictional` });
      }
    }
    return f;
  };
}

/** C11: a shipped id must never disappear (progress would be orphaned). */
export function checkLockedIds(locked: readonly string[], shippedIds: readonly string[], allowRemove: readonly string[]): Finding[] {
  const out = new Set(shippedIds);
  const allowed = new Set(allowRemove);
  return locked
    .filter((id) => !out.has(id) && !allowed.has(id))
    .map((id) => ({ check: 'C11', severity: 'error', itemId: id, message: 'previously shipped id is missing; pass --allow-remove <id> to drop it on purpose' }));
}

/** C12 (info): several variants but the note does not say "bağlama göre". */
export function checkContextNote(item: Item): Finding[] {
  return item.acceptedAnswers.length > 1 && !item.noteTr.toLocaleLowerCase('tr').includes('bağlama göre')
    ? [{ check: 'C12', severity: 'info', itemId: item.id, message: 'several variants; noteTr has no "bağlama göre"' }]
    : [];
}

/** C13: a production bundle with no verified item is useless. */
export function checkNotEmpty(shipped: readonly Item[]): Finding[] {
  return shipped.length === 0 ? [{ check: 'C13', severity: 'error', message: 'no verified items to ship' }] : [];
}

export interface ContentResult {
  findings: Finding[];
  /** verified:true only, in draft-file order. */
  shipped: Item[];
}

export interface RunOptions {
  locked?: readonly string[];
  allowRemove?: readonly string[];
  /** Extra per-item checks (privacy, T1.4). */
  extraItemChecks?: ReadonlyArray<(item: Item) => Finding[]>;
}

export function runChecks(drafts: readonly DraftFile[], opts: RunOptions = {}): ContentResult {
  const { items, findings } = checkSchema(drafts);
  findings.push(...checkIds(items));
  const perItem = [checkCounts, checkCommonMistake, checkCloze, checkDuplicateVariants, checkVerifiedNote, checkContextNote, ...(opts.extraItemChecks ?? [])];
  for (const item of items) for (const check of perItem) findings.push(...check(item));
  const shipped = items.filter((i) => i.verified);
  findings.push(...checkLockedIds(opts.locked ?? [], shipped.map((i) => i.id), opts.allowRemove ?? []));
  findings.push(...checkNotEmpty(shipped));
  return { findings, shipped };
}

export function hasErrors(findings: readonly Finding[]): boolean {
  return findings.some((f) => f.severity === 'error');
}

export function countByCategory(items: readonly Item[]): Record<Category, number> {
  const counts: Record<Category, number> = { aux_to: 0, object: 0, word_form: 0, preposition: 0, work_vocab: 0 };
  for (const i of items) counts[i.category]++;
  return counts;
}

/** Stable JSON with sorted object keys (for contentVersion). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}
