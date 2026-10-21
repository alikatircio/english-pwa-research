// Export/import file formats (07 §3.8; decision 14). Pure: no IDB, no DOM.
// Every file is JSON with `format` + `schemaVersion`; imports are recognised by `format`.
// `schemaVersion` is independent of the IndexedDB version.
import { z } from 'zod';
import { isDayKey } from './dates.ts';
import { ItemSchema } from './itemSchema.ts';
import type { AnswerLog, Box, DailyCounter, Flag, Item, NotebookEntry, Progress } from './types.ts';

export const SCHEMA_VERSION = 1;

export const FORMATS = {
  backup: 'english-pwa-backup',
  notebook: 'english-pwa-notebook',
  items: 'english-pwa-items',
  flags: 'english-pwa-flags',
} as const;
export type FileFormat = (typeof FORMATS)[keyof typeof FORMATS];
const KNOWN_FORMATS: readonly string[] = Object.values(FORMATS);

/** Decision 14: the user solved the item, so imported items are always these values. */
export const USER_IMPORT = { source: 'user-error', verified: true, verifiedNote: 'user-import' } as const;

// --- Record types not in types.ts ------------------------------------------

/** `importedItems` store row: an Item plus when it was imported. */
export type ImportedItem = Item & { importedAt: number };

export interface BackupData {
  progress: Progress[];
  dailyCounters: DailyCounter[];
  notebook: NotebookEntry[];
  flags: Flag[];
  answerLog: AnswerLog[];
  importedItems: ImportedItem[];
}

/** 1) Full backup (Settings → export). The session is never exported. */
export interface BackupFileV1 {
  format: typeof FORMATS.backup;
  schemaVersion: 1;
  exportedAt: string;
  appVersion: string;
  contentVersion: string;
  data: BackupData;
}

export interface NotebookExportEntry {
  id: string;
  textTr: string;
  contextTr?: string;
}

/** 2) Notebook export (to be solved in Claude). Open entries only. */
export interface NotebookExportV1 {
  format: typeof FORMATS.notebook;
  schemaVersion: 1;
  exportedAt: string;
  entries: NotebookExportEntry[];
}

/** 3) Items import (returned from Claude), after parsing: decision 14 fields already overwritten. */
export interface ItemsImportV1 {
  format: typeof FORMATS.items;
  schemaVersion: 1;
  items: Item[];
}

export type FlagReportRow = Flag & { targetChunk: string; situationTr: string; canonical: string };

/** 4) Flags report (export only, for review). */
export interface FlagsReportV1 {
  format: typeof FORMATS.flags;
  schemaVersion: 1;
  exportedAt: string;
  contentVersion: string;
  flags: FlagReportRow[];
}

// --- Schemas ---------------------------------------------------------------
// Records use z.object (unknown keys are stripped); items stay strict via ItemSchema.

const text = z.string().trim().min(1);
const epochMs = z.number().int().nonnegative();
const dayKey = z.string().refine(isDayKey, 'expected a calendar day YYYY-MM-DD');
const isoTimestamp = z.iso.datetime({ offset: true });
const box: z.ZodType<Box> = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const grade = z.enum(['correct', 'partial', 'wrong']);
const count = z.number().int().nonnegative();
const version1 = z.literal(SCHEMA_VERSION);

export const ProgressSchema: z.ZodType<Progress> = z.object({
  itemId: text,
  box,
  dueOn: dayKey,
  introducedOn: dayKey,
  lastAnsweredOn: dayKey,
  lastGrade: grade,
  updatedAt: epochMs,
});

export const DailyCounterSchema: z.ZodType<DailyCounter> = z.object({
  day: dayKey,
  newIntroduced: count,
  reviewsAnswered: count,
});

export const NotebookEntrySchema: z.ZodType<NotebookEntry> = z.object({
  id: text,
  textTr: text,
  contextTr: text.optional(),
  contextItemId: text.optional(),
  createdAt: epochMs,
  status: z.enum(['open', 'converted']),
  convertedItemId: text.optional(),
});

export const FlagSchema: z.ZodType<Flag> = z.object({
  itemId: text,
  flaggedAt: epochMs,
  screen: z.enum(['question', 'result']),
  userAnswer: z.string().optional(),
  contentVersion: text,
});

export const AnswerLogSchema: z.ZodType<AnswerLog> = z.object({
  id: z.number().int().positive().optional(),
  at: epochMs,
  day: dayKey,
  itemId: text,
  answer: z.string(),
  grade,
  gradedBy: z.enum(['auto', 'self']),
  hintStage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  isRepeat: z.boolean(),
  boxBefore: box.nullable(),
  boxAfter: box.nullable(),
});

/** Validates `rest` with ItemSchema and re-reports its issues at the current path. */
function parseItemInto(rest: Record<string, unknown>, ctx: z.RefinementCtx): Item | typeof z.NEVER {
  const r = ItemSchema.safeParse(rest);
  if (r.success) return r.data;
  for (const issue of r.error.issues) ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path });
  return z.NEVER;
}

export const ImportedItemSchema: z.ZodType<ImportedItem> = z
  .looseObject({ importedAt: epochMs })
  .transform(({ importedAt, ...rest }, ctx) => {
    const item = parseItemInto(rest, ctx);
    return { ...item, importedAt };
  });

/**
 * An item coming back from Claude. Decision 14: `source`, `verified` and
 * `verifiedNote` are overwritten whatever the file says (absent, or a
 * different value), then the result must pass the strict ItemSchema.
 */
export const ImportedItemInputSchema: z.ZodType<Item, unknown> = z
  .looseObject({})
  .transform((raw, ctx) => parseItemInto({ ...raw, ...USER_IMPORT }, ctx));

export const BackupFileSchema: z.ZodType<BackupFileV1> = z.object({
  format: z.literal(FORMATS.backup),
  schemaVersion: version1,
  exportedAt: isoTimestamp,
  appVersion: text,
  contentVersion: text,
  data: z.object({
    progress: z.array(ProgressSchema),
    dailyCounters: z.array(DailyCounterSchema),
    notebook: z.array(NotebookEntrySchema),
    flags: z.array(FlagSchema),
    answerLog: z.array(AnswerLogSchema),
    importedItems: z.array(ImportedItemSchema),
  }),
});

export const NotebookExportSchema: z.ZodType<NotebookExportV1> = z.object({
  format: z.literal(FORMATS.notebook),
  schemaVersion: version1,
  exportedAt: isoTimestamp,
  entries: z.array(z.object({ id: text, textTr: text, contextTr: text.optional() })),
});

export const ItemsImportSchema: z.ZodType<ItemsImportV1, unknown> = z.object({
  format: z.literal(FORMATS.items),
  schemaVersion: version1,
  items: z.array(ImportedItemInputSchema).min(1),
});

export const FlagsReportSchema: z.ZodType<FlagsReportV1> = z.object({
  format: z.literal(FORMATS.flags),
  schemaVersion: version1,
  exportedAt: isoTimestamp,
  contentVersion: text,
  flags: z.array(
    z.object({
      itemId: text,
      flaggedAt: epochMs,
      screen: z.enum(['question', 'result']),
      userAnswer: z.string().optional(),
      contentVersion: text,
      targetChunk: z.string(),
      situationTr: z.string(),
      canonical: z.string(),
    }),
  ),
});

// --- Detection + parsing ---------------------------------------------------

export type ParsedFile =
  | { format: typeof FORMATS.backup; file: BackupFileV1 }
  | { format: typeof FORMATS.notebook; file: NotebookExportV1 }
  | { format: typeof FORMATS.items; file: ItemsImportV1 }
  | { format: typeof FORMATS.flags; file: FlagsReportV1 };

/**
 * Machine-readable error; the UI maps `code` to Turkish text (strings.tr.ts)
 * and shows `path` so the user can find the broken spot.
 */
export type ImportErrorCode = 'invalid-json' | 'unknown-format' | 'wrong-format' | 'unsupported-version' | 'invalid';
export interface ImportError {
  code: ImportErrorCode;
  /** Dotted path with array indices, e.g. `data.progress[3].box`; '' for the whole file. */
  path: string;
  message: string;
}

export type ParseResult<F extends FileFormat = FileFormat> =
  | { ok: true; value: Extract<ParsedFile, { format: F }> }
  | { ok: false; errors: ImportError[] };

const SCHEMAS: { [F in FileFormat]: z.ZodType<Extract<ParsedFile, { format: F }>['file'], unknown> } = {
  [FORMATS.backup]: BackupFileSchema,
  [FORMATS.notebook]: NotebookExportSchema,
  [FORMATS.items]: ItemsImportSchema,
  [FORMATS.flags]: FlagsReportSchema,
};

export function formatPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out === '' ? String(seg) : `.${String(seg)}`;
  }
  return out;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The file's `format` if it is one we know, else null. Does not validate anything else. */
export function detectFormat(input: unknown): FileFormat | null {
  if (!isRecord(input)) return null;
  const f = input.format;
  return typeof f === 'string' && KNOWN_FORMATS.includes(f) ? (f as FileFormat) : null;
}

const fail = (code: ImportErrorCode, path: string, message: string) => ({
  ok: false as const,
  errors: [{ code, path, message }],
});

/**
 * Validates a whole file before anything is written (07 §3.8). `input` is the
 * raw file text or already-parsed JSON. `accept` lists the formats the calling
 * screen can import; a known but different format yields `wrong-format`.
 * A `schemaVersion` newer than supported is rejected.
 */
export function parseFile<F extends FileFormat>(input: unknown, accept: readonly F[]): ParseResult<F> {
  let json: unknown = input;
  if (typeof input === 'string') {
    try {
      json = JSON.parse(input);
    } catch (e) {
      return fail('invalid-json', '', e instanceof Error ? e.message : 'not valid JSON');
    }
  }
  const format = detectFormat(json);
  if (format === null) return fail('unknown-format', 'format', 'not an english-pwa file');
  if (!(accept as readonly FileFormat[]).includes(format)) {
    return fail('wrong-format', 'format', `expected ${accept.join(' or ')}, got ${format}`);
  }
  const version = (json as Record<string, unknown>).schemaVersion;
  if (typeof version === 'number' && version > SCHEMA_VERSION) {
    return fail('unsupported-version', 'schemaVersion', `schemaVersion ${version} is newer than supported ${SCHEMA_VERSION}`);
  }
  const r = SCHEMAS[format].safeParse(json);
  if (!r.success) {
    return {
      ok: false,
      errors: r.error.issues.map((i) => ({ code: 'invalid' as const, path: formatPath(i.path), message: i.message })),
    };
  }
  return { ok: true, value: { format, file: r.data } as Extract<ParsedFile, { format: F }> };
}

// --- Builders (export side) ------------------------------------------------

export function buildBackupFile(
  data: BackupData,
  meta: { now: number; appVersion: string; contentVersion: string },
): BackupFileV1 {
  return {
    format: FORMATS.backup,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(meta.now).toISOString(),
    appVersion: meta.appVersion,
    contentVersion: meta.contentVersion,
    data,
  };
}

/** Only `open` entries are exported, oldest first. */
export function buildNotebookExport(entries: readonly NotebookEntry[], now: number): NotebookExportV1 {
  return {
    format: FORMATS.notebook,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    entries: entries
      .filter((e) => e.status === 'open')
      .toSorted((a, b) => a.createdAt - b.createdAt)
      .map(({ id, textTr, contextTr }) => (contextTr === undefined ? { id, textTr } : { id, textTr, contextTr })),
  };
}

/** Each flag is joined with its item; an item missing from the catalog gets empty strings. */
export function buildFlagsReport(
  flags: readonly Flag[],
  items: ReadonlyMap<string, Item>,
  contentVersion: string,
  now: number,
): FlagsReportV1 {
  return {
    format: FORMATS.flags,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    contentVersion,
    flags: flags.map((f) => {
      const item = items.get(f.itemId);
      return {
        ...f,
        targetChunk: item?.targetChunk ?? '',
        situationTr: item?.situationTr ?? '',
        canonical: item?.acceptedAnswers[0] ?? '',
      };
    }),
  };
}

// --- Items import plan -----------------------------------------------------

export type RejectedItemReason = 'builtin-id' | 'duplicate-in-file';
export interface RejectedItem {
  id: string;
  reason: RejectedItemReason;
}

export interface ItemsImportPlan {
  items: ImportedItem[];
  rejected: RejectedItem[];
  /** Notebook entries whose id matches an accepted item's `notebookId`, now `converted`. */
  notebookUpdates: NotebookEntry[];
}

/**
 * 07 §3.8: an id that collides with bundled content is rejected and listed;
 * a matching `notebookId` turns that notebook entry into `converted`.
 * The same id twice in one file keeps the first. Re-importing an id already in
 * `importedItems` is allowed and replaces it.
 */
export function planItemsImport(
  items: readonly Item[],
  ctx: { builtinIds: ReadonlySet<string>; notebook: readonly NotebookEntry[]; now: number },
): ItemsImportPlan {
  const accepted: ImportedItem[] = [];
  const rejected: RejectedItem[] = [];
  const seen = new Set<string>();
  const byId = new Map(ctx.notebook.map((e) => [e.id, e]));
  const updates = new Map<string, NotebookEntry>();
  for (const item of items) {
    if (ctx.builtinIds.has(item.id)) {
      rejected.push({ id: item.id, reason: 'builtin-id' });
      continue;
    }
    if (seen.has(item.id)) {
      rejected.push({ id: item.id, reason: 'duplicate-in-file' });
      continue;
    }
    seen.add(item.id);
    accepted.push({ ...item, ...USER_IMPORT, importedAt: ctx.now });
    const entry = item.notebookId === undefined ? undefined : byId.get(item.notebookId);
    if (entry) updates.set(entry.id, { ...entry, status: 'converted', convertedItemId: item.id });
  }
  return { items: accepted, rejected, notebookUpdates: [...updates.values()] };
}
