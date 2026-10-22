// The example item in the Claude prompt must also pass the content checks the
// build applies to curated items (07 §4), so Claude copies a clean model.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkCloze,
  checkCommonMistake,
  checkContextNote,
  checkCounts,
  checkDuplicateVariants,
  checkPrivacyPatterns,
  makeProperNounCheck,
  type Allowlist,
} from '../../scripts/content-checks.ts';
import { USER_IMPORT } from '../../src/domain/backup.ts';
import { EXAMPLE_ITEM } from '../../src/domain/claudePrompt.ts';
import type { Item } from '../../src/domain/types.ts';

const item: Item = { ...EXAMPLE_ITEM, ...USER_IMPORT };
const allow = JSON.parse(readFileSync('content/privacy-allowlist.json', 'utf8')) as Allowlist;

describe('Claude prompt example item vs content checks', () => {
  it.each([
    ['C3 counts', checkCounts],
    ['C4 common mistake', checkCommonMistake],
    ['C5 cloze', checkCloze],
    ['C6 duplicate variants', checkDuplicateVariants],
    ['C8 privacy patterns', checkPrivacyPatterns],
    ['C10 proper nouns', makeProperNounCheck(allow)],
    ['C12 context note', checkContextNote],
  ])('%s: no findings', (_name, check) => {
    expect(check(item)).toEqual([]);
  });
});
