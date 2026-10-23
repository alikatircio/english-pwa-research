import { t } from '../ui/strings.tr.ts';
import { Component, createContext, lazy, Suspense, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

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
      const target = opener;
      opener = null;
      if (target?.isConnected) {
        target.focus();
        // The hidden screen is revealed after this tick (display:none ignores focus), so focus again once it is back.
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            if (target.isConnected && (target as unknown) !== document.activeElement) target.focus();
          });
        }
      }
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

// Lazy: keeps the content bundle out of this module's import graph (unit tests load it without the aliases).
const TopicScreen = lazy(() => import('../ui/screens/TopicScreen.tsx').then((m) => ({ default: m.TopicScreen })));

// A failed chunk load must not leave the screen hidden with nothing to go back to.
class OverlayBoundary extends Component<{ onClose: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="screen">
        <div className="screen__body">
          <p role="alert">{t.topicLoadFailed}</p>
          <button type="button" className="btn" onClick={this.props.onClose}>
            {t.topicClose}
          </button>
        </div>
      </div>
    );
  }
}

// Renders the page of the open overlay; nothing when none is open.
export function OverlayHost() {
  const { overlay, close } = useOverlay();
  if (overlay?.kind === 'topic') {
    return (
      <OverlayBoundary onClose={close}>
        <Suspense
          fallback={
            <p className="muted" role="status">
              {t.loading}
            </p>
          }
        >
          <TopicScreen key={overlay.topicId} topicId={overlay.topicId} />
        </Suspense>
      </OverlayBoundary>
    );
  }
  return null;
}
