/**
 * Focus the first thing of the card that was just rendered (call right after a
 * flushSync inside the tap), so iOS opens the keyboard (02 §3). On a resumed
 * result screen it is the verdict heading.
 */
export function focusCard(): void {
  document.querySelector<HTMLElement>('.answer-input, .verdict')?.focus();
}
