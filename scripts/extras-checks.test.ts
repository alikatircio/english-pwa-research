import { describe, expect, it } from 'vitest';
import { AREA_IDS } from '../src/domain/areas.ts';
import type { DiagnosticQuestion, Message, Topic } from '../src/domain/extrasSchema.ts';
import { checkPrivacyPatterns, makeDenylistCheck, type DraftFile } from './content-checks.ts';
import {
  checkDiagnosticSet,
  checkMessage,
  checkQuestion,
  checkTextPrivacy,
  checkTopic,
  checkTopicOverlap,
  runExtrasChecks,
  type ShippedItem,
} from './extras-checks.ts';
import fixture from '../content/fixtures/e2e-extras.json' with { type: 'json' };
import e2eItems from '../content/fixtures/e2e-items.json' with { type: 'json' };

const items: ShippedItem[] = [
  { id: 'a-heads-up', acceptedAnswers: ['Just a heads-up: the test is failing.'] },
  { id: 'get-back-to-someone', acceptedAnswers: ["I'll get back to you."] },
  { id: 'look-into', acceptedAnswers: ['I will look into it.'] },
];
const itemIds = new Set(items.map((i) => i.id));
const itemMap = new Map(items.map((i) => [i.id, i]));

const question: DiagnosticQuestion = {
  id: 'dq-present-perfect-1',
  area: 'present-perfect',
  category: 'grammar',
  refs: [{ book: 'Gram', unit: 7 }],
  relatedItemIds: ['a-heads-up'],
  promptTr: 'Soru.',
  stem: 'I ___ the report.',
  options: [{ id: 'a', text: 'have sent' }, { id: 'b', text: 'sent' }, { id: 'c', text: 'am sending' }],
  correct: ['a', 'b'],
  explanationTr: 'Açıklama.',
  verified: true,
  verifiedNote: 'n',
};
const topic: Topic = {
  id: 'topic-a',
  area: 'future',
  titleTr: 'Başlık',
  summaryTr: 'Özet',
  sections: [
    {
      headingTr: 'Bölüm',
      bodyTr: ['Paragraf.'],
      examples: [
        { en: 'We will go.', tr: 'Gideriz.', highlight: 'will go' },
        { en: 'I will call.', tr: 'Ararım.', highlight: 'will call' },
        { en: 'It will rain.', tr: 'Yağmur yağacak.', highlight: 'will rain' },
      ],
    },
  ],
  traps: [{ wrongEn: 'I call you tomorrow.', rightEn: "I'll call you tomorrow.", noteTr: 'Not.' }],
  itemIds: ['a-heads-up'],
  refs: [{ book: 'Gram', unit: 20, titleTr: 'Başlık' }],
  verified: true,
  verifiedNote: 'n',
};
const message: Message = {
  id: 'msg-a',
  channel: 'teams',
  contextTr: 'Bağlam',
  text: "Hi,\nJust a heads-up: it fails.\nI'll get back to you.\nI will look into it.",
  blanked: "Hi,\nJust a ___: it fails.\nI'll get ___ to you.\nI will look ___ it.",
  blanks: [{ itemId: 'a-heads-up' }, { itemId: 'get-back-to-someone' }, { itemId: 'look-into' }],
  verified: true,
  verifiedNote: 'n',
};

const errors = (f: Array<{ severity: string; message: string }>): string[] => f.filter((x) => x.severity === 'error').map((x) => x.message);
const file = (raw: unknown): DraftFile[] => [{ file: 'x.verified.json', raw }];
const noPrivacy = { text: [] };

describe('C16 diagnostic', () => {
  it('passes a valid question', () => expect(checkQuestion(question, itemIds)).toEqual([]));
  it('rejects 2 options', () => expect(errors(checkQuestion({ ...question, options: question.options.slice(0, 2) }, itemIds)).join()).toContain('3–4'));
  it('rejects options equal after normalisation', () => {
    const q = { ...question, options: [...question.options.slice(0, 2), { id: 'c' as const, text: 'Sent.' }] };
    expect(errors(checkQuestion(q, itemIds)).join()).toContain('unique after normalisation');
  });
  it('rejects correct = all options', () => expect(errors(checkQuestion({ ...question, correct: ['a', 'b', 'c'] }, itemIds)).join()).toContain('correct must have 1–2'));
  it('rejects correct id that is no option', () => expect(errors(checkQuestion({ ...question, correct: ['d'] }, itemIds)).join()).toContain('not an option id'));
  it('rejects two blanks in the stem', () => expect(errors(checkQuestion({ ...question, stem: 'I ___ ___ it.' }, itemIds)).join()).toContain('at most one'));
  it('rejects unknown related item, warns on empty', () => {
    expect(errors(checkQuestion({ ...question, relatedItemIds: ['nope'] }, itemIds)).join()).toContain('not a shipped item');
    const w = checkQuestion({ ...question, relatedItemIds: [] }, itemIds);
    expect(errors(w)).toEqual([]);
    expect(w[0]?.severity).toBe('warning');
  });
  it('set size: 0 or 48 with 3 per area', () => {
    const all = AREA_IDS.flatMap((area) => [1, 2, 3].map((n) => ({ ...question, id: `dq-${area}-${n}`, area })));
    expect(checkDiagnosticSet([])).toEqual([]);
    expect(checkDiagnosticSet(all)).toEqual([]);
    expect(errors(checkDiagnosticSet(all.slice(1)))).toHaveLength(1);
  });
  it('schema: bad id prefix, unknown area, unknown key, out-of-range unit; duplicate ids', () => {
    const bad = [{ ...question, id: 'x-1' }, { ...question, area: 'nope' }, { ...question, extra: 1 }, { ...question, refs: [{ book: 'Gram', unit: 146 }] }];
    const r = runExtrasChecks({ diagnostic: file(bad), topics: [], messages: [] }, items, noPrivacy);
    expect(errors(r.findings)).toHaveLength(4);
    const dup = runExtrasChecks({ diagnostic: file([question, question]), topics: [], messages: [] }, items, noPrivacy);
    expect(errors(dup.findings).join()).toContain('duplicate id');
  });
  it('ships only verified records', () => {
    const r = runExtrasChecks({ diagnostic: [], topics: file([topic, { ...topic, id: 'topic-b', verified: false }]), messages: [] }, items, noPrivacy);
    expect(r.topics.map((t) => t.id)).toEqual(['topic-a']);
  });
});

describe('C17 topics', () => {
  it('passes a valid topic', () => expect(checkTopic(topic, itemIds)).toEqual([]));
  it('needs 3–5 examples, highlights inside the sentence, 1–2 traps, a book ref and ≤150 words', () => {
    const s = topic.sections[0]!;
    const one = { ...s, examples: [{ ...s.examples[0]!, highlight: 'shall go' }] };
    const long = { ...s, bodyTr: [Array(151).fill('söz').join(' ')], examples: [] };
    const msg = errors(checkTopic({ ...topic, sections: [one, long], traps: [], refs: [] }, itemIds)).join();
    for (const part of ['3–5 examples', 'highlight "shall go"', '150 words', 'traps', 'book reference']) expect(msg).toContain(part);
  });
  it('rejects 5 sections', () => {
    const s = topic.sections[0]!;
    expect(errors(checkTopic({ ...topic, sections: [s, s, s, s, s] }, itemIds)).join()).toContain('1–4');
  });
  it('rejects 4 paragraphs', () => {
    const s = { ...topic.sections[0]!, bodyTr: ['a', 'b', 'c', 'd'] };
    expect(errors(checkTopic({ ...topic, sections: [s] }, itemIds)).join()).toContain('1–3');
  });
  it('rejects 0 examples', () => {
    const s = { ...topic.sections[0]!, examples: [] };
    expect(errors(checkTopic({ ...topic, sections: [s] }, itemIds)).join()).toContain('examples');
  });
  it('rejects unknown itemId', () => expect(errors(checkTopic({ ...topic, itemIds: ['nope'] }, itemIds)).join()).toContain('not a shipped item'));
  it('warns when an item is in two topics', () => {
    expect(checkTopicOverlap([topic])).toEqual([]);
    const w = checkTopicOverlap([topic, { ...topic, id: 'topic-b' }]);
    expect(w).toHaveLength(1);
    expect(w[0]?.severity).toBe('warning');
  });
});

describe('C18 messages', () => {
  it('passes a valid message', () => expect(checkMessage(message, itemMap)).toEqual([]));
  it('rejects 2 blanks', () => {
    const m = { ...message, blanked: "Hi,\nJust a heads-up: it fails.\nI'll get ___ to you.\nI will look ___ it.", blanks: message.blanks.slice(1) };
    expect(errors(checkMessage(m, itemMap)).join()).toContain('3–5');
  });
  it('rejects blanks length != ___ count', () => expect(errors(checkMessage({ ...message, blanks: message.blanks.slice(0, 2) }, itemMap)).join()).toContain('blanks has 2'));
  it('rejects blanked that does not match text', () => expect(errors(checkMessage({ ...message, blanked: 'Hi ___ ___ ___' }, itemMap)).join()).toContain('blankAnswers'));
  it('rejects unknown itemId', () => {
    const blanks = [{ itemId: 'nope' }, ...message.blanks.slice(1)];
    expect(errors(checkMessage({ ...message, blanks }, itemMap)).join()).toContain('not a shipped item');
  });
  it('rejects a blank answer that is not a word of the item answer', () => {
    const blanks = [message.blanks[1]!, message.blanks[0]!, message.blanks[2]!];
    expect(errors(checkMessage({ ...message, blanks }, itemMap)).join()).toContain('not a word');
  });
  it('schema: msg- prefix and channel', () => {
    const r = runExtrasChecks({ diagnostic: [], topics: [], messages: file([{ ...message, id: 'a' }, { ...message, channel: 'mail' }]) }, items, noPrivacy);
    expect(errors(r.findings)).toHaveLength(2);
  });
});

describe('privacy over extras text', () => {
  const checks = { text: [checkPrivacyPatterns, makeDenylistCheck(['Zorlu'])] };
  it('passes clean text', () => expect(checkTextPrivacy('x', [['stem', 'We ship it.']], checks)).toEqual([]));
  it('flags e-mail and denylisted names, but not verifiedNote patterns', () => {
    expect(checkTextPrivacy('x', [['stem', 'Mail me at a@b.com']], checks).length).toBeGreaterThan(0);
    expect(checkTextPrivacy('x', [['promptTr', 'Zorlu yazdı']], checks)).toHaveLength(1);
    expect(checkTextPrivacy('x', [['verifiedNote', 'see https://x.com']], checks)).toEqual([]);
  });
  it('runExtrasChecks applies it to every text field', () => {
    const r = runExtrasChecks({ diagnostic: [], topics: [], messages: file([{ ...message, contextTr: 'Zorlu ile' }]) }, items, checks);
    expect(errors(r.findings).join()).toContain('denylisted');
  });
});

describe('e2e fixture', () => {
  it('is valid against the e2e items', () => {
    const r = runExtrasChecks(
      { diagnostic: file(fixture.diagnostic), topics: file(fixture.topics), messages: file(fixture.messages) },
      e2eItems.items as ShippedItem[],
      noPrivacy,
    );
    expect(errors(r.findings)).toEqual([]);
    expect(r.diagnostic).toHaveLength(48);
  });
});
