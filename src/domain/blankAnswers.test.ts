import { describe, expect, it } from 'vitest';
import { blankAnswers, refillBlanks } from './blankAnswers.ts';

describe('blankAnswers', () => {
  it('returns the hidden word for a single blank', () => {
    expect(blankAnswers('We need ___ rerun the suite.', 'We need to rerun the suite.')).toEqual(['to']);
  });
  it('returns several answers in order', () => {
    expect(blankAnswers('I ___ ___ Deniz.', 'I agree with Deniz.')).toEqual(['agree', 'with']);
  });
  it('handles punctuation and regex characters around blanks', () => {
    expect(blankAnswers('Is (it) ___?', 'Is (it) done?')).toEqual(['done']);
    expect(blankAnswers('I ___ agree.', "I don't agree.")).toEqual(["don't"]);
  });
  it('returns null when the blanked text does not fit the original', () => {
    expect(blankAnswers('We need ___ rerun the suite.', 'We want to rerun the suite.')).toBeNull();
    expect(blankAnswers('We need ___.', 'We need to rerun the suite.')).toBeNull();
  });
  it('returns null when there is no blank', () => {
    expect(blankAnswers('Same sentence.', 'Same sentence.')).toBeNull();
  });
  it('does not let a blank match nothing', () => {
    expect(blankAnswers('We need ___ rerun', 'We need  rerun')).toBeNull();
  });
  it('refillBlanks round-trips', () => {
    const o = 'I agree with Deniz.';
    const b = 'I ___ ___ Deniz.';
    expect(refillBlanks(b, blankAnswers(b, o) ?? [])).toBe(o);
  });
});
