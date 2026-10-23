import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ContentBundle, Item } from '../src/domain/types.ts';
import {
  canonicalJson,
  countByCategory,
  checkCloze,
  checkCommonMistake,
  applyModelBlanks,
  applyDailyContext,
  checkDailyContext,
  checkContextNote,
  checkModelBlanks,
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

describe('modelBlanks overlay and C14', () => {
  const withBlanks = (modelBlanks: (string | null)[]) => item({ modelBlanks });

  it('attaches entries by id without mutating the inputs', () => {
    const drafts = [{ file: 'a', raw: [good] }];
    const r = applyModelBlanks(drafts, [{ file: 'modelBlanks-a.verified.json', raw: { [good.id]: ['Can you ___ the pipeline?'] } }]);
    expect(r.findings).toEqual([]);
    expect((r.drafts[0]?.raw as Item[])[0]?.modelBlanks).toEqual(['Can you ___ the pipeline?']);
    expect(good.modelBlanks).toBeUndefined();
    expect((drafts[0]?.raw as Item[])[0]?.modelBlanks).toBeUndefined();
  });
  it('flags unknown ids, wrong lengths and non-object overlays', () => {
    const ov = (raw: unknown) => applyModelBlanks([{ file: 'a', raw: [good] }], [{ file: 'o', raw }]).findings;
    expect(ov({ ghost: [null] })[0]?.message).toContain('unknown item id');
    expect(ov({ [good.id]: [null, null] })[0]?.message).toContain('length 2');
    expect(ov({ [good.id]: [] })[0]?.check).toBe('C14');
    expect(ov([])[0]?.message).toContain('JSON object');
  });
  it('runChecks surfaces overlay errors and the schema rejects bad entries', () => {
    const r = runChecks([{ file: 'a', raw: [good] }], { modelBlanks: [{ file: 'o', raw: { [good.id]: [''] } }] });
    expect(hasErrors(r.findings)).toBe(true);
  });
  it('C14 passes null entries and a correct blanked sentence', () => {
    expect(checkModelBlanks(withBlanks([null]))).toEqual([]);
    expect(checkModelBlanks(withBlanks(['Can you ___ the pipeline?']))).toEqual([]);
    expect(checkModelBlanks(withBlanks(['Can you ___ ___ pipeline?']))).toEqual([]);
    expect(checkModelBlanks(good)).toEqual([]);
  });
  it('C14 fails when the blanked sentence does not refill to the original', () => {
    const f = checkModelBlanks(withBlanks(['Could you ___ the pipeline?']));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ check: 'C14', severity: 'error', itemId: good.id });
  });
  it('C14 fails with no blank or more than 5 blanks', () => {
    expect(checkModelBlanks(withBlanks(['Can you rerun the pipeline?']))[0]?.message).toContain('0 blanks');
    const long = item({ modelSentences: ['a b c d e f g', 'a b c d e f g'], modelBlanks: ['___ ___ ___ ___ ___ ___ g'] });
    expect(checkModelBlanks(long)[0]?.message).toContain('6 blanks');
    const five = item({ modelSentences: ['a b c d e f g', 'a b c d e f g'], modelBlanks: ['___ ___ ___ ___ ___ f g'] });
    expect(checkModelBlanks(five)).toEqual([]);
  });
});

describe('dailyContext overlay and C15', () => {
  const daily = { sentence: 'I need to call my sister tonight.', blank: 'I need ___ call my ___ tonight.' };
  const withDaily = (dailyContext: { sentence: string; blank: string }) => item({ dailyContext });

  it('attaches entries by id, treats null as absent, and does not mutate the inputs', () => {
    const drafts = [{ file: 'a', raw: [good] }];
    const r = applyDailyContext(drafts, [{ file: 'dailyContext-a.verified.json', raw: { [good.id]: daily } }]);
    expect(r.findings).toEqual([]);
    expect((r.drafts[0]?.raw as Item[])[0]?.dailyContext).toEqual(daily);
    expect((drafts[0]?.raw as Item[])[0]?.dailyContext).toBeUndefined();
    const n = applyDailyContext(drafts, [{ file: 'o', raw: { [good.id]: null } }]);
    expect(n.findings).toEqual([]);
    expect((n.drafts[0]?.raw as Item[])[0]).not.toHaveProperty('dailyContext');
  });
  it('flags unknown ids, repeats and non-object overlays', () => {
    const ov = (...raws: unknown[]) => applyDailyContext([{ file: 'a', raw: [good] }], raws.map((raw) => ({ file: 'o', raw }))).findings;
    expect(ov({ ghost: null })[0]).toMatchObject({ check: 'C15', message: expect.stringContaining('unknown item id') });
    expect(ov({ [good.id]: daily }, { [good.id]: daily })[0]?.message).toContain('more than once');
    expect(ov([])[0]?.message).toContain('JSON object');
  });
  it('runChecks rejects unknown fields inside a dailyContext entry (strict schema)', () => {
    const r = runChecks([{ file: 'a', raw: [good] }], { dailyContext: [{ file: 'o', raw: { [good.id]: { ...daily, extra: 1 } } }] });
    expect(hasErrors(r.findings)).toBe(true);
  });
  it('C15 passes a good entry and items without one', () => {
    expect(checkDailyContext(good)).toEqual([]);
    expect(checkDailyContext(withDaily(daily))).toEqual([]);
    expect(checkDailyContext(withDaily({ sentence: 'a b c d', blank: '___ ___ ___ d' }))).toEqual([]);
  });
  it('C15 fails when the blank does not refill to the sentence', () => {
    const f = checkDailyContext(withDaily({ sentence: daily.sentence, blank: 'I want ___ call my ___ tonight.' }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ check: 'C15', severity: 'error', itemId: good.id });
  });
  it('C15 fails with no blank or more than 3 blanks', () => {
    expect(checkDailyContext(withDaily({ sentence: daily.sentence, blank: daily.sentence }))[0]?.message).toContain('0 blanks');
    expect(checkDailyContext(withDaily({ sentence: 'a b c d e', blank: '___ ___ ___ ___ e' }))[0]?.message).toContain('4 blanks');
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
  function run(items: unknown[], lock?: string[], extra: string[] = [], { ci = false, overlays = {} as Record<string, unknown> } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'content-'));
    writeFileSync(join(dir, 'batch-x.verified.json'), JSON.stringify(items));
    for (const [name, body] of Object.entries(overlays)) writeFileSync(join(dir, name), JSON.stringify(body));
    writeFileSync(join(dir, 'ignored.json'), JSON.stringify([{ broken: true }]));
    const lockFile = join(dir, 'lock.json');
    if (lock) writeFileSync(lockFile, JSON.stringify(lock));
    const out = join(dir, 'out', 'items.json');
    const env = { ...process.env };
    delete env.PRIVACY_DENYLIST;
    // The unit tests themselves run on CI: pin the mode each case expects.
    if (ci) env.CI = 'true';
    else delete env.CI;
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

  it('attaches modelBlanks overlays to the shipped items and ignores them as item files', () => {
    const r = run([good], undefined, [], { overlays: { 'modelBlanks-a.verified.json': { 'could-you-base-verb': ['Can you ___ the pipeline?'] } } });
    expect(r.code).toBe(0);
    const bundle = JSON.parse(readFileSync(r.out, 'utf8')) as ContentBundle;
    expect(bundle.items[0]?.modelBlanks).toEqual(['Can you ___ the pipeline?']);
  });

  it.each([
    ['unknown id', { nope: [null] }],
    ['wrong length', { 'could-you-base-verb': [null, null] }],
    ['blanks that do not refill', { 'could-you-base-verb': ['Can you ___ the logs?'] }],
  ])('exits 1 on a modelBlanks overlay with %s (C14)', (_n, overlay) => {
    const r = run([good], undefined, [], { overlays: { 'modelBlanks-a.verified.json': overlay } });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('[C14]');
  });

  it('attaches dailyContext overlays (null = absent) and ignores them as item files', () => {
    const r = run([good], undefined, [], {
      overlays: { 'dailyContext-a.verified.json': { 'could-you-base-verb': { sentence: 'Could you pass the salt?', blank: 'Could you ___ the ___?' } } },
    });
    expect(r.code).toBe(0);
    const bundle = JSON.parse(readFileSync(r.out, 'utf8')) as ContentBundle;
    expect(bundle.items[0]?.dailyContext).toEqual({ sentence: 'Could you pass the salt?', blank: 'Could you ___ the ___?' });
    const none = run([good], undefined, [], { overlays: { 'dailyContext-a.verified.json': { 'could-you-base-verb': null } } });
    expect(none.code).toBe(0);
    expect((JSON.parse(readFileSync(none.out, 'utf8')) as ContentBundle).items[0]).not.toHaveProperty('dailyContext');
  });

  it.each([
    ['unknown id', { nope: null }],
    ['blanks that do not refill', { 'could-you-base-verb': { sentence: 'Could you pass the salt?', blank: 'Would you ___ the salt?' } }],
    ['too many blanks', { 'could-you-base-verb': { sentence: 'a b c d e', blank: '___ ___ ___ ___ e' } }],
  ])('exits 1 on a dailyContext overlay with %s (C15)', (_n, overlay) => {
    const r = run([good], undefined, [], { overlays: { 'dailyContext-a.verified.json': overlay } });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('[C15]');
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

  it('on CI a missing denylist is an error, not a warning (C9, review 09 #10)', () => {
    const r = run([good], undefined, [], { ci: true });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('[C9] ERROR');
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

describe('countByCategory', () => {
  it('lists every category in CATEGORIES order, zero when absent', () => {
    expect(countByCategory([item({ category: 'object' }), item({ id: 'b', category: 'object' })])).toEqual({
      aux_to: 0,
      object: 2,
      word_form: 0,
      preposition: 0,
      work_vocab: 0,
    });
  });
});
