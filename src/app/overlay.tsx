import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

// Read-only page shown on top of the current screen. The screen stays mounted underneath (see App.tsx).
export type AppOverlay = { kind: 'topic'; topicId: string };

export interface OverlayController {
  get: () => AppOverlay | undefined;
  subscribe: (listener: () => void) => () => void;
  open: (overlay: AppOverlay) => void;
  close: () => void;
}

interface FocusTarget {
  focus: () => void;
  isConnected: boolean;
}

export function createOverlayController(getActive: () => FocusTarget | null = () => document.activeElement as HTMLElement | null): OverlayController {
  let current: AppOverlay | undefined;
  let opener: FocusTarget | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    get: () => current,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    open(overlay) {
      if (!current) opener = getActive();
      current = overlay;
      emit();
    },
    close() {
      if (!current) return;
      current = undefined;
      emit();
      if (opener?.isConnected) opener.focus();
      opener = null;
    },
  };
}

const OverlayContext = createContext<OverlayController | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => createOverlayController());
  return <OverlayContext.Provider value={controller}>{children}</OverlayContext.Provider>;
}

export function useOverlay(): { overlay: AppOverlay | undefined; open: OverlayController['open']; close: OverlayController['close'] } {
  const controller = useContext(OverlayContext);
  if (!controller) throw new Error('useOverlay outside OverlayProvider');
  const overlay = useSyncExternalStore(controller.subscribe, controller.get);
  return { overlay, open: controller.open, close: controller.close };
}

// Renders nothing until a page exists for the overlay kind.
export function OverlayHost() {
  useOverlay();
  return null;
}
