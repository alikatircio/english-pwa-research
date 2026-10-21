import { describe, expect, it } from 'vitest';
import {
  acceptedSet,
  collapseWhitespace,
  dropInnerSeparators,
  expandContractions,
  hyphensToSpaces,
  isAccepted,
  normalizeAnswer as n,
  splitDigitsAndLetters,
  straightenQuotes,
  trimEdgePunctuation,
} from './normalize.ts';

const same = (a: string, b: string) => expect(n(a)).toBe(n(b));
const differ = (a: string, b: string) => expect(n(a)).not.toBe(n(b));

describe('steps', () => {
  it('straightens smart quotes', () => {
    expect(straightenQuotes('I’ll ‘x’ “y” „z″ ʼ′')).toBe(`I'll 'x' "y" "z" ''`);
  });
  it('drops inner , ; :', () => {
    expect(dropInnerSeparators('a, b; c: d')).toBe('a  b  c  d');
  });
  it('turns hyphens and dashes into spaces', () => {
    expect(hyphensToSpaces('heads-up re–run a—b')).toBe('heads up re run a b');
  });
  it('splits digit/letter boundaries', () => {
    expect(splitDigitsAndLetters('3pm qa123')).toBe('3 pm qa 123');
  });
  it('trims edge punctuation but keeps apostrophes', () => {
    expect(trimEdgePunctuation(" ...hi?!… ")).toBe('hi');
    expect(trimEdgePunctuation("'tis testers'")).toBe("'tis testers'");
  });
  it('collapses whitespace including newlines', () => {
    expect(collapseWhitespace(' a \n\t b  ')).toBe('a b');
  });
  it('expands contractions token-wise', () => {
    expect(expandContractions("i'm sure it's done. it's fine")).toBe('i am sure it is done. it is fine');
    expect(expandContractions('')).toBe('');
  });
});

describe('normalizeAnswer (07 §7.2 + 06 decisions 19, 20, 22, 24)', () => {
  it('ignores case, edge whitespace and trailing punctuation', () => {
    same('  Could you check the logs?  ', 'could you check the logs');
    same('COULD YOU CHECK THE LOGS?', 'could you check the logs');
    expect(n('  Could you check the logs?  ')).toBe('could you check the logs');
  });
  it('treats smart apostrophes like straight ones', () => {
    same('I’ll send it.', "I'll send it.");
  });
  it('drops double quotes (smart and straight) and brackets', () => {
    expect(n('“quoted” (word)')).toBe('quoted word');
    expect(n('"Done"')).toBe('done');
  });
  it('expands the fixed contraction table', () => {
    same("I'm", 'I am');
    same("can't", 'cannot');
    same('can not', 'cannot');
    same("can't", 'can not');
    same("won't", 'will not');
    same("don't", 'do not');
    same("it's", 'it is');
    same("We're", 'We are');
    same("they've", 'they have');
    same("she'll", 'she will');
    same("didn't", 'did not');
    same("needn't", 'need not');
    same("there's", 'there is');
  });
  it("leaves possessives, 'd and let's alone", () => {
    expect(n("Ayşe's ticket")).toBe("ayşe's ticket");
    expect(n("I'd check it")).toBe("i'd check it");
    expect(n("Let's discuss it")).toBe("let's discuss it");
  });
  it("keeps it's ≠ its and set up ≠ setup", () => {
    differ("it's", 'its');
    differ('set up', 'setup');
  });
  it('hyphen = space (decision 20/22), but not hyphen = nothing', () => {
    same('heads-up', 'heads up');
    same('re-run', 're run');
    differ('re-run', 'rerun');
  });
  it('"3pm" = "3 pm" (decision 20/22)', () => {
    same('at 3pm', 'at 3 pm');
    same('QA-123', 'QA 123');
  });
  it('ignores inner , ; : (decision 19)', () => {
    same('Hi Ayşe, could you check it?', 'Hi Ayşe could you check it');
    same('Just a quick reminder: the demo is at 2.', 'Just a quick reminder the demo is at 2');
    same('a;b', 'a b');
  });
  it('keeps inner . ? ! (decision 24)', () => {
    differ('Thanks. I will check it.', 'Thanks I will check it');
    differ('Done? Yes', 'Done Yes');
  });
  it('uses locale-independent lower-casing (Turkish I regression)', () => {
    expect(n("I'LL")).toBe('i will');
    expect(n('I AGREE')).toBe('i agree');
  });
  it('strips trailing ?!… and leading quotes, collapses whitespace', () => {
    expect(n('"Really?!…')).toBe('really');
    expect(n('I  will\n send   it')).toBe('i will send it');
  });
  it('NFC-normalises (decomposed ş)', () => {
    same('Ayşe', 'Ayşe');
  });
  it('expands contractions next to kept inner punctuation', () => {
    expect(n("It's done. It's fine.")).toBe('it is done. it is fine');
  });
});

describe('isAccepted', () => {
  const accepted = ['Could you check the logs?', 'Can you check the logs?'];
  it('matches any variant', () => {
    expect(isAccepted('can you check the logs', accepted)).toBe(true);
    expect(isAccepted('COULD YOU CHECK THE LOGS.', accepted)).toBe(true);
  });
  it('rejects near misses (no similarity score)', () => {
    expect(isAccepted('Could you to check the logs?', accepted)).toBe(false);
    expect(isAccepted('Could you check logs?', accepted)).toBe(false);
  });
  it('rejects empty answers', () => {
    expect(isAccepted('  ?! ', ['?'])).toBe(false);
  });
  it('accepts a precomputed set', () => {
    expect(isAccepted("I’ll send it", acceptedSet(["I will send it."]))).toBe(true);
  });
});
