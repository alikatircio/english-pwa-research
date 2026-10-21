import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ContentBundle, Item } from '../src/domain/types.ts';
import {
  canonicalJson,
  checkCloze,
  checkCommonMistake,
  checkContextNote,
  checkCounts,
  checkDuplicateVariants,
  checkIds,
  checkLockedIds,
  checkNotEmpty,
  checkSchema,
  checkVerifiedNote,
  hasErrors,
  runChecks,
} from './content-checks.ts';

const good: Item = {
  id: 'could-you-base-verb',
  category: 'aux_to',
  level: 1,
  targetChunk: 'can / could + base verb',
  clozeTemplate: 'Could you ___ the logs?',
  situationTr: 'Mert’e yazıyorsun.',
  acceptedAnswers: ['Could you check the logs?', 'Can you check the logs?', 'Could you please check the logs?'],
  modelSentences: ['Could you check the logs?', 'Can you rerun the pipeline?'],
  commonMistake: 'Could you to check the logs?',
  checklistTr: ['to koymadın, değil mi?'],
  noteTr: 'Bağlama göre can de olur.',
  source: 'curated',
  verified: true,
  verifiedNote: 'checked',
};
const item = (patch: Partial<Item>): Item => ({ ...good, ...patch });

describe('C1 schema', () => {
  it('passes a valid item and reports an invalid one with its path', () => {
    const r = checkSchema([{ file: 'a.json', raw: [good, { ...good, id: 'x', level: 9 }] }]);
    expect(r.items).toHaveLength(1);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.message).toContain('level');
  });
  it('rejects a non-array file', () => {
    expect(hasErrors(checkSchema([{ file: 'a.json', raw: {} }]).findings)).toBe(true);
  });
});

describe('C2 ids', () => {
  it('flags duplicates across files', () => {
    expect(checkIds([good, good])[0]?.message).toBe('duplicate id');
    expect(checkIds([good, item({ id: 'other' })])).toEqual([]);
  });
  it('flags non-kebab ids', () => {
    expect(checkIds([item({ id: 'Bad_Id' })])).toHaveLength(1);
  });
});

describe('C3 counts', () => {
  it('green for the good item', () => expect(checkCounts(good)).toEqual([]));
  it.each([
    ['2 accepted answers', { acceptedAnswers: good.acceptedAnswers.slice(0, 2) }],
    ['9 accepted answers', { acceptedAnswers: [...good.acceptedAnswers, 'a', 'b', 'c', 'd', 'e', 'f'] }],
    ['canonical ≠ first model sentence', { modelSentences: ['Can you check the logs?', 'x'] }],
    ['1 model sentence', { modelSentences: ['Could you check the logs?'] }],
    ['4 model sentences', { modelSentences: ['Could you check the logs?', 'a', 'b', 'c'] }],
    ['0 checklist items', { checklistTr: [] }],
  ])('red for %s', (_n, patch) => {
    expect(hasErrors(checkCounts(item(patch)))).toBe(true);
  });
});

describe('C4 commonMistake', () => {
  it('green when the mistake is not accepted', () => expect(checkCommonMistake(good)).toEqual([]));
  it('green when there is no mistake', () => expect(checkCommonMistake(item({ commonMistake: undefined }))).toEqual([]));
  it('red when the mistake normalises to an accepted answer', () => {
    expect(hasErrors(checkCommonMistake(item({ commonMistake: 'could you check the LOGS' })))).toBe(true);
  });
});

describe('C5 cloze', () => {
  it('green for aligned cloze', () => expect(checkCloze(good)).toEqual([]));
  it('red without a blank', () => expect(hasErrors(checkCloze(item({ clozeTemplate: 'Could you check the logs?' })))).toBe(true));
  it('red on token count mismatch', () => expect(hasErrors(checkCloze(item({ clozeTemplate: 'Could you ___ logs?' })))).toBe(true));
  it('red when a visible token differs', () => expect(hasErrors(checkCloze(item({ clozeTemplate: 'Could you ___ the files?' })))).toBe(true));
});

describe('C6 duplicate variants (warning)', () => {
  it('warns on variants equal after normalisation', () => {
    const f = checkDuplicateVariants(item({ acceptedAnswers: ['I will go.', "I'll go", 'Sure'] }));
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe('warning');
  });
  it('green otherwise', () => expect(checkDuplicateVariants(good)).toEqual([]));
});

describe('C7 verifiedNote', () => {
  it('red when verified without a note', () => expect(hasErrors(checkVerifiedNote(item({ verifiedNote: undefined })))).toBe(true));
  it('green for unverified without a note', () => expect(checkVerifiedNote(item({ verified: false, verifiedNote: undefined }))).toEqual([]));
});

describe('C11 locked ids', () => {
  it('red when a shipped id disappears', () => expect(hasErrors(checkLockedIds(['a', 'b'], ['a'], []))).toBe(true));
  it('green with --allow-remove', () => expect(checkLockedIds(['a', 'b'], ['a'], ['b'])).toEqual([]));
});

describe('C12 / C13', () => {
  it('C12 is info only', () => {
    expect(checkContextNote(item({ noteTr: 'Not.' }))[0]?.severity).toBe('info');
    expect(checkContextNote(good)).toEqual([]);
  });
  it('C13 red on empty output', () => {
    expect(hasErrors(checkNotEmpty([]))).toBe(true);
    expect(checkNotEmpty([good])).toEqual([]);
  });
});

describe('runChecks', () => {
  it('ships only verified items', () => {
    const r = runChecks([{ file: 'a', raw: [good, item({ id: 'unverified', verified: false })] }]);
    expect(r.shipped.map((i) => i.id)).toEqual(['could-you-base-verb']);
    expect(hasErrors(r.findings)).toBe(false);
  });
  it('the real verified drafts pass and works-on-my-end is not shipped (decision 28)', () => {
    const drafts = ['batch-a.verified.json', 'batch-b.verified.json'].map((file) => ({
      file,
      raw: JSON.parse(readFileSync(join('content/drafts', file), 'utf8')) as unknown,
    }));
    const r = runChecks(drafts);
    expect(r.findings.filter((f) => f.severity === 'error')).toEqual([]);
    expect(r.shipped).toHaveLength(67);
    expect(r.shipped.some((i) => i.id === 'works-on-my-end')).toBe(false);
  });
  it('the e2e fixture passes every check', () => {
    const bundle = JSON.parse(readFileSync('content/fixtures/e2e-items.json', 'utf8')) as ContentBundle;
    const r = runChecks([{ file: 'e2e', raw: bundle.items }]);
    expect(r.findings.filter((f) => f.severity !== 'info')).toEqual([]);
    expect(r.shipped).toHaveLength(12);
  });
  it('canonicalJson sorts keys', () => {
    expect(canonicalJson({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":1}');
  });
});

describe('build-content CLI', () => {
  function run(items: unknown[], lock?: string[], extra: string[] = []) {
    const dir = mkdtempSync(join(tmpdir(), 'content-'));
    writeFileSync(join(dir, 'x.verified.json'), JSON.stringify(items));
    writeFileSync(join(dir, 'ignored.json'), JSON.stringify([{ broken: true }]));
    const lockFile = join(dir, 'lock.json');
    if (lock) writeFileSync(lockFile, JSON.stringify(lock));
    const out = join(dir, 'out', 'items.json');
    const r = spawnSync(process.execPath, ['scripts/build-content.ts', '--drafts', dir, '--out', out, '--lock', lockFile, ...extra], { encoding: 'utf8' });
    return { code: r.status, stderr: r.stderr, out, lockFile };
  }

  it.each([
    ['duplicate id', [good, good]],
    ['short acceptedAnswers', [item({ acceptedAnswers: ['Could you check the logs?'] })]],
    ['cloze mismatch', [item({ clozeTemplate: 'Could you ___ logs?' })]],
    ['commonMistake accepted', [item({ commonMistake: 'Can you check the logs?' })]],
    ['no verified items', [item({ verified: false })]],
  ])('exits 1 on %s', (_n, items) => {
    const r = run(items);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('content:build failed');
  });

  it('exits 0, writes only verified items and grows the lock', () => {
    const r = run([good, item({ id: 'not-yet', verified: false })], ['could-you-base-verb']);
    expect(r.code).toBe(0);
    const bundle = JSON.parse(readFileSync(r.out, 'utf8')) as ContentBundle;
    expect(bundle.items.map((i) => i.id)).toEqual(['could-you-base-verb']);
    expect(bundle.contentVersion).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.parse(readFileSync(r.lockFile, 'utf8'))).toEqual(['could-you-base-verb']);
  });

  it('exits 1 when a locked id disappears, 0 with --allow-remove', () => {
    expect(run([good], ['could-you-base-verb', 'gone']).code).toBe(1);
    const r = run([good], ['could-you-base-verb', 'gone'], ['--allow-remove', 'gone']);
    expect(r.code).toBe(0);
    expect(JSON.parse(readFileSync(r.lockFile, 'utf8'))).toEqual(['could-you-base-verb']);
  });
});
