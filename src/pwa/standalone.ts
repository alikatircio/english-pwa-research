// Is the app running from the home screen (standalone) rather than in a browser tab?
// iOS Safari exposes the non-standard `navigator.standalone`; others use the display-mode media query.

export function isStandalone(): boolean {
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
}
