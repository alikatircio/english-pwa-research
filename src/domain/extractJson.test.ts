import { describe, expect, it } from 'vitest';
import { extractJson } from './extractJson.ts';

const json = '{\n  "format": "english-pwa-items",\n  "items": []\n}';

describe('extractJson', () => {
  it('raw JSON is returned trimmed', () => {
    expect(extractJson(`  \n${json}\n\n`)).toBe(json);
  });

  it('a ```json block with prose before and after yields only the block', () => {
    const reply = `İşte item'lar:\n\n\`\`\`json\n${json}\n\`\`\`\n\nEmin olmadıklarım:\n- "x" için iki çeviri olabilir.`;
    expect(extractJson(reply)).toBe(json);
  });

  it('a fence without a language tag, and CRLF line endings', () => {
    expect(extractJson(`\`\`\`\n${json}\n\`\`\``)).toBe(json);
    expect(extractJson(`Tamam.\r\n\`\`\`json\r\n{"a": 1}\r\n\`\`\`\r\n`)).toBe('{"a": 1}');
  });

  it('a one-line fence', () => {
    expect(extractJson('```json {"a": 1}```')).toBe('{"a": 1}');
  });

  it('only the first fenced block is taken', () => {
    expect(extractJson('```json\n{"a": 1}\n```\nve\n```json\n{"b": 2}\n```')).toBe('{"a": 1}');
  });

  it('an unclosed fence (cut-off copy) takes the rest of the text', () => {
    expect(extractJson(`\`\`\`json\n${json}\n`)).toBe(json);
  });

  it('text with no fence and no JSON is returned as is (parseFile reports it)', () => {
    expect(extractJson('merhaba')).toBe('merhaba');
    expect(extractJson('   ')).toBe('');
    expect(extractJson('```json\n```')).toBe('');
  });
});
