import { useEffect } from 'react';

/**
 * Keeps the CSS variable --vvh equal to the visual viewport height so the card
 * screen (a flex column of that height) shrinks above the iOS keyboard and the
 * primary button stays in normal flow at its bottom (02 §3, 07 §6.4).
 * After the keyboard closes (focusout) the height is re-read and any leftover
 * page scroll is reset, a known iOS standalone glitch.
 */
export function useVisualViewportHeight(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;
    let frame = 0;
    const update = () => {
      root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    };
    const onFocusOut = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        update();
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      document.removeEventListener('focusout', onFocusOut);
      root.style.removeProperty('--vvh');
    };
  }, []);
}
