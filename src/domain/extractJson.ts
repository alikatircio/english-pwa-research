// Pasted import (iPhone: copy Claude's reply from claude.ai). Pure.

/**
 * The first Markdown code fence (``` with an optional language tag such as
 * `json`) up to its closing fence, or to the end if the reply was cut off.
 */
const FENCED = /```[\w-]*[^\S\n]*\n?([\s\S]*?)(?:```|$)/;

/**
 * The JSON part of a pasted text: the content of the first fenced block when
 * there is one (Claude may write prose before it and list unsure items after
 * it), otherwise the whole text. Trimmed; validation is left to parseFile.
 */
export function extractJson(text: string): string {
  const fenced = FENCED.exec(text);
  return (fenced ? (fenced[1] ?? '') : text).trim();
}
