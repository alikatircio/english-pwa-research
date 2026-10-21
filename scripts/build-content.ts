// Content build (07 §4): validate drafts → write src/content/items.json.
// Run: npm run content:build  (node scripts/build-content.ts; Node type stripping)
// Any 'error' finding stops the build with exit code 1.
//
// Flags (defaults in parentheses):
//   --drafts <dir>        (content/drafts)  reads every *.verified.json, sorted by name
//   --out <file>          (src/content/items.json)
//   --lock <file>         (content/shipped-ids.lock.json)
//   --allow-remove <id>   may be repeated; lets a locked id disappear on purpose
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentBundle } from '../src/domain/types.ts';
import { canonicalJson, countByCategory, hasErrors, runChecks, type DraftFile, type Finding } from './content-checks.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface Args {
  drafts: string;
  out: string;
  lock: string;
  allowRemove: string[];
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    drafts: join(ROOT, 'content/drafts'),
    out: join(ROOT, 'src/content/items.json'),
    lock: join(ROOT, 'content/shipped-ids.lock.json'),
    allowRemove: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (value === undefined) throw new Error(`missing value for ${flag}`);
    if (flag === '--drafts') args.drafts = resolve(value);
    else if (flag === '--out') args.out = resolve(value);
    else if (flag === '--lock') args.lock = resolve(value);
    else if (flag === '--allow-remove') args.allowRemove.push(value);
    else throw new Error(`unknown flag ${flag}`);
    i++;
  }
  return args;
}

function readDrafts(dir: string): DraftFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.verified.json'))
    .sort()
    .map((file) => ({ file, raw: JSON.parse(readFileSync(join(dir, file), 'utf8')) as unknown }));
}

function readLock(file: string): string[] {
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) throw new Error(`${file} must be a JSON array of ids`);
  return parsed;
}

function print(f: Finding): void {
  const where = [f.file, f.itemId].filter(Boolean).join(' / ');
  const line = `[${f.check}] ${f.severity.toUpperCase()} ${where ? where + ': ' : ''}${f.message}`;
  if (f.severity === 'error') console.error(line);
  else if (f.severity === 'warning') console.warn(line);
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const drafts = readDrafts(args.drafts);
  const locked = readLock(args.lock);
  const { findings, shipped } = runChecks(drafts, { locked, allowRemove: args.allowRemove });

  findings.forEach(print);
  const info = findings.filter((f) => f.severity === 'info').length;
  if (info > 0) console.log(`(${info} info notes hidden)`);

  if (hasErrors(findings)) {
    console.error(`content:build failed: ${findings.filter((f) => f.severity === 'error').length} error(s). Nothing written.`);
    return 1;
  }

  const contentVersion = createHash('sha256').update(canonicalJson(shipped)).digest('hex').slice(0, 12);
  const bundle: ContentBundle = { contentVersion, generatedAt: new Date().toISOString(), items: shipped };
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify(bundle, null, 2) + '\n');

  // The lock only ever grows (except via --allow-remove).
  const removed = new Set(args.allowRemove);
  const nextLock = [...locked.filter((id) => !removed.has(id))];
  for (const { id } of shipped) if (!nextLock.includes(id)) nextLock.push(id);
  writeFileSync(args.lock, JSON.stringify(nextLock, null, 2) + '\n');

  const counts = Object.entries(countByCategory(shipped)).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`content:build ok: ${shipped.length} verified item(s) [${counts}], contentVersion ${contentVersion}`);
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  console.error(`content:build crashed: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
}
