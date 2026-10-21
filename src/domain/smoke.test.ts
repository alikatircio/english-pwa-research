import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('runs in a node environment without DOM globals', () => {
    expect(typeof globalThis.document).toBe('undefined');
    expect(1 + 1).toBe(2);
  });
});
