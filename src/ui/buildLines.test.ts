import { describe, expect, it } from 'vitest';
import type { BuildInfo } from '../buildInfo.ts';
import { formatBuildDate, homeVersionLine, settingsVersionLine, updatedNoteText } from './buildLines.ts';

const b: BuildInfo = { version: '1.3.0', date: '2026-10-23', sha: 'abc1234', contentVersion: '080feb50dd7d' };

describe('build lines', () => {
  it('formats the ISO build date as dd.mm.yyyy and leaves other text alone', () => {
    expect(formatBuildDate('2026-10-23')).toBe('23.10.2026');
    expect(formatBuildDate('2026-10-23T10:00:00Z')).toBe('23.10.2026');
    expect(formatBuildDate('dev')).toBe('dev');
  });

  it('builds the Settings, Home and updated lines', () => {
    expect(settingsVersionLine(b)).toBe('Sürüm 1.3.0 · 23.10.2026 · abc1234 · içerik 080feb50');
    expect(homeVersionLine(b)).toBe('v1.3.0 · 23.10.2026');
    expect(updatedNoteText(b)).toBe('Güncellendi: sürüm 1.3.0 (23.10.2026)');
  });
});
