import { describe, expect, it } from 'vitest';
import { FORMATS, parseFile, USER_IMPORT } from './backup.ts';
import { buildClaudePrompt, EXAMPLE_FILE, EXAMPLE_ITEM, EXAMPLE_NOTEBOOK_ID } from './claudePrompt.ts';
import { CATEGORIES, ItemSchema, KEBAB_CASE } from './itemSchema.ts';
import type { NotebookEntry } from './types.ts';

const NOW_ISO = '2026-11-02T08:00:00.000Z';

const entry = (id: string, extra: Partial<NotebookEntry> = {}): NotebookEntry => ({
  id,
  textTr: `metin ${id}`,
  createdAt: 1,
  status: 'open',
  ...extra,
});

/** The ```json block inside the prompt, parsed. */
function exampleBlock(prompt: string): unknown {
  const m = /^```json\n([\s\S]*?)\n```$/m.exec(prompt);
  if (!m?.[1]) throw new Error('no json block in prompt');
  return JSON.parse(m[1]);
}

describe('buildClaudePrompt: the example cannot drift from the schema', () => {
  const prompt = buildClaudePrompt([entry('e1')], NOW_ISO);

  it('embeds exactly EXAMPLE_FILE as the only JSON block', () => {
    expect(exampleBlock(prompt)).toEqual(EXAMPLE_FILE);
    expect(prompt.match(/^```json$/gm)).toHaveLength(1);
  });

  it('the example passes the real items-import parse (ItemsImportV1)', () => {
    const r = parseFile(JSON.stringify(exampleBlock(prompt)), [FORMATS.items]);
    expect(r.ok, r.ok ? '' : JSON.stringify(r.errors)).toBe(true);
    if (!r.ok) return;
    expect(r.value.file.items).toEqual([{ ...EXAMPLE_ITEM, ...USER_IMPORT }]);
  });

  it('the example item with the decision-14 fields passes the strict ItemSchema', () => {
    expect(() => ItemSchema.parse({ ...EXAMPLE_ITEM, ...USER_IMPORT })).not.toThrow();
  });

  it('the example follows the prompt rules it states', () => {
    const i = EXAMPLE_ITEM;
    expect(i.id).toMatch(KEBAB_CASE);
    expect(i.id.startsWith('nb-')).toBe(true);
    expect(i.notebookId).toBe(EXAMPLE_NOTEBOOK_ID);
    expect(i.acceptedAnswers.length).toBeGreaterThanOrEqual(3);
    expect(i.acceptedAnswers.length).toBeLessThanOrEqual(8);
    expect(i.acceptedAnswers[0]).toBe(i.modelSentences[0]);
    expect(i.acceptedAnswers).not.toContain(i.commonMistake);
    expect(i.checklistTr.length).toBeLessThanOrEqual(3);
    expect(i.noteTr).toContain('bağlama göre');
    expect(i.clozeTemplate.split(/\s+/)).toHaveLength((i.acceptedAnswers[0] ?? '').split(/\s+/).length);
    // situationTr does not leak the answer.
    expect(i.situationTr.toLowerCase()).not.toContain('escalate');
  });

  it('the shape uses the current format and schemaVersion', () => {
    expect(EXAMPLE_FILE.format).toBe('english-pwa-items');
    expect(EXAMPLE_FILE.schemaVersion).toBe(1);
  });
});

describe('buildClaudePrompt: instructions', () => {
  const prompt = buildClaudePrompt([entry('e1')], NOW_ISO);

  it.each([
    'B1–B2',
    'QA',
    'fiil + nesne + edat',
    'cevabı ele vermez',
    '3–8',
    'modelSentences[0]',
    'commonMistake asla acceptedAnswers içinde olmaz',
    '"___"',
    'Sözcük sayısı',
    'en fazla 3',
    'bağlama göre',
    'Ayşe, Mert, Deniz',
    'emin değilsen uydurma',
    'Return ONLY one JSON code block',
    '"nb-"',
    'kebab-case',
    'notebookId',
    'level',
    'Omit items you are unsure about and list them after the JSON',
  ])('mentions %s', (needle) => {
    expect(prompt).toContain(needle);
  });

  it('lists every allowed category', () => {
    for (const c of CATEGORIES) expect(prompt).toContain(`- ${c}:`);
  });
});

describe('buildClaudePrompt: entries', () => {
  it('lists open entries oldest first, with context only when present; converted ones are left out', () => {
    const prompt = buildClaudePrompt(
      [
        entry('newer', { textTr: 'sorunu ekibe yükseltmek', createdAt: 20, contextTr: '[Teams] Mert’e yazıyorsun.' }),
        entry('done', { status: 'converted', convertedItemId: 'x', textTr: 'eski not' }),
        entry('older', { textTr: 'PR’ı incelemek', createdAt: 10 }),
      ],
      NOW_ISO,
    );
    const tail = prompt.slice(prompt.indexOf('# Defter notları'));
    expect(tail).toBe(
      [
        '# Defter notları / Notebook entries',
        '',
        `Dışa aktarma / Exported at: ${NOW_ISO}`,
        '',
        '1. id: older',
        '   textTr: "PR’ı incelemek"',
        '2. id: newer',
        '   textTr: "sorunu ekibe yükseltmek"',
        '   contextTr: "[Teams] Mert’e yazıyorsun."',
        '',
      ].join('\n'),
    );
    expect(prompt).not.toContain('eski not');
  });

  it('quotes entry text so a line break or quote cannot break the list', () => {
    const prompt = buildClaudePrompt([entry('q', { textTr: 'bir "alıntı"\nve satır' })], NOW_ISO);
    expect(prompt).toContain('   textTr: "bir \\"alıntı\\"\\nve satır"');
  });

  it('is deterministic for the same input', () => {
    const es = [entry('a'), entry('b', { createdAt: 2 })];
    expect(buildClaudePrompt(es, NOW_ISO)).toBe(buildClaudePrompt(es, NOW_ISO));
  });
});
