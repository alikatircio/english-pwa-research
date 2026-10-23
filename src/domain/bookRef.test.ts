import { describe, expect, it } from 'vitest';
import { formatBookRef } from './bookRef.ts';

describe('formatBookRef', () => {
  it('formats Gram units', () => {
    expect(formatBookRef({ book: 'Gram', unit: 25 })).toBe('Gram ünite 25 · k.50 · PDF 62');
  });
  it('formats Coll units', () => {
    expect(formatBookRef({ book: 'Coll', unit: 6 })).toBe('Coll ünite 6 · k.16 · PDF 20');
  });
});
