import type { BuildInfo } from '../buildInfo.ts';
import { t } from './strings.tr.ts';

/** "2026-10-23" → "23.10.2026"; anything else is returned unchanged. */
export function formatBuildDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Settings footer: "Sürüm 1.3.0 · 23.10.2026 · abc1234 · içerik 080feb50". */
export function settingsVersionLine(b: BuildInfo): string {
  return t.versionSettings(b.version, formatBuildDate(b.date), b.sha, b.contentVersion.slice(0, 8));
}

/** Home footer: "v1.3.0 · 23.10.2026". */
export function homeVersionLine(b: BuildInfo): string {
  return t.versionHome(b.version, formatBuildDate(b.date));
}

/** Home note after an update: "Güncellendi: sürüm 1.3.0 (23.10.2026)". */
export function updatedNoteText(b: BuildInfo): string {
  return t.updatedNote(b.version, formatBuildDate(b.date));
}
