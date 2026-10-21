import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import bundle from '@content';
import { systemClock } from '../domain/clock.ts';
import { openAppDb, type AppDb } from '../storage/db.ts';
import { createActions, type Actions } from './actions.ts';
import { boot } from './boot.ts';
import type { AppState } from './state.ts';
import { createStore } from './store.ts';

interface AppContextValue {
  state: AppState;
  actions: Actions | undefined;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createStore);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [db, setDb] = useState<AppDb | null>(null);

  useEffect(() => {
    let cancelled = false;
    boot({ bundle, clock: systemClock, openDb: () => openAppDb({ onBlocking: () => location.reload() }) })
      .then(({ db: opened, state: booted }) => {
        if (cancelled) return opened.close();
        setDb(opened);
        store.dispatch({ type: 'booted', state: booted });
      })
      .catch((e: unknown) => {
        if (!cancelled) store.dispatch({ type: 'fatal', message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const actions = useMemo(
    () => (db ? createActions({ db, clock: systemClock, getState: store.getState, dispatch: store.dispatch }) : undefined),
    [db, store],
  );

  return <AppContext.Provider value={{ state, actions }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
