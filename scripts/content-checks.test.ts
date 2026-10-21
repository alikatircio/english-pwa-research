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
  checkPrivacyPatterns,
  checkSchema,
  checkVerifiedNote,
  hasErrors,
  makeDenylistCheck,
  makeProperNounCheck,
  parseDenylist,
  runChecks,
} from './content-checks.ts';
import allowlist from '../content/privacy-allowlist.json' with { type: 'json' };

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

describe('C8 privacy patterns', () => {
  it('green for the good item', () => expect(checkPrivacyPatterns(good)).toEqual([]));
  it.each([
    ['e-mail', 'Send it to ayse.k@example-corp.com.'],
    ['URL', 'See https://jira.internal/browse/QA-1'],
    ['www', 'Open www.example.org'],
    ['domain', 'Our host is acme.io'],
    ['IP', 'Staging is on 10.0.12.7'],
    ['phone', 'Call me on +90 532 123 45 67'],
  ])('red for %s', (_n, text) => {
    expect(hasErrors(checkPrivacyPatterns(item({ situationTr: text })))).toBe(true);
  });
  it('does not flag ticket keys like QA-123', () => {
    expect(checkPrivacyPatterns(item({ situationTr: 'QA-123 ve QA-124' }))).toEqual([]);
  });
  it('exempts verifiedNote (cites public sources)', () => {
    expect(checkPrivacyPatterns(item({ verifiedNote: 'dictionary.com, https://www.oxfordlearnersdictionaries.com' }))).toEqual([]);
  });
});

describe('C9 denylist', () => {
  const check = makeDenylistCheck(parseDenylist('# comment\n\nZeynep Kaya\nAcmeSoft\n'));
  it('parses lines, skipping comments and blanks', () => {
    expect(parseDenylist('# x\n a \n\nb\r\n')).toEqual(['a', 'b']);
  });
  it('red for a denylisted term in any field, case-insensitive, with Turkish suffix', () => {
    expect(hasErrors(check(item({ situationTr: "zeynep kaya'ya yazıyorsun" })))).toBe(true);
    expect(hasErrors(check(item({ noteTr: 'ACMESOFT ekibi' })))).toBe(true);
  });
  it('matches whole words only and does not print the term', () => {
    expect(check(item({ noteTr: 'AcmeSoftware' }))).toEqual([]);
    expect(check(item({ noteTr: 'AcmeSoft' }))[0]?.message).not.toContain('AcmeSoft');
  });
});

describe('C10 proper-noun candidates (warning)', () => {
  const check = makeProperNounCheck(allowlist);
  it('warns on an unknown capitalised word mid-sentence', () => {
    const f = check(item({ situationTr: "[Teams] Zeynep'e yazıyorsun." }));
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe('warning');
  });
  it('ignores allowlisted names/terms and sentence-initial words', () => {
    expect(check(item({ situationTr: "[Teams, rica] Mert'e yazıyorsun: \"Logları kontrol et.\" Sonra Ayşe'ye.", modelSentences: ['Could you ask Deniz?', 'The PR is on Jira.'] }))).toEqual([]);
  });
  it('the fictional names in the real drafts produce no warning', () => {
    const drafts = ['batch-a.verified.json', 'batch-b.verified.json'].flatMap(
      (file) => JSON.parse(readFileSync(join('content/drafts', file), 'utf8')) as Item[],
    );
    expect(drafts.flatMap(check)).toEqual([]);
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
    const env = { ...process.env };
    delete env.PRIVACY_DENYLIST;
    const r = spawnSync(
      process.execPath,
      ['scripts/build-content.ts', '--drafts', dir, '--out', out, '--lock', lockFile, '--denylist', join(dir, 'deny.txt'), ...extra],
      { encoding: 'utf8', env },
    );
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

  it('exits 1 on an e-mail address (C8)', () => {
    expect(run([item({ noteTr: 'Ask ali@corp.example.com' })]).code).toBe(1);
  });

  it('exits 1 on a denylisted name from the file, warns when no denylist exists (C9)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deny-'));
    const deny = join(dir, 'deny.txt');
    writeFileSync(deny, 'Zeynep\n');
    expect(run([good], undefined, ['--denylist', deny]).code).toBe(0); // good item has no denylisted term
    expect(run([item({ situationTr: "Zeynep'e yaz." })], undefined, ['--denylist', deny]).code).toBe(1);
    const noList = run([good]);
    expect(noList.code).toBe(0);
    expect(noList.stderr).toContain('no privacy denylist');
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
