import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import bundle from '@content';
import extras from '@extras';
import { systemClock } from '../domain/clock.ts';
import { createConnection, openAppDb, type DbConnection } from '../storage/db.ts';
import { createActions, type Actions } from './actions.ts';
import { boot } from './boot.ts';
import { mayReloadForDb, type AppState } from './state.ts';
import { createStore } from './store.ts';

interface AppContextValue {
  state: AppState;
  actions: Actions | undefined;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createStore);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [db, setDb] = useState<DbConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    let conn: DbConnection | undefined;
    let unsubscribe: (() => void) | undefined;
    // A newer version in another tab waits for us (09 #3): close and reload only once no round is open.
    const onBlocking = (close: () => void) => {
      if (unsubscribe) return;
      const tryReload = () => {
        if (!mayReloadForDb(store.getState())) return;
        unsubscribe?.();
        close();
        location.reload();
      };
      unsubscribe = store.subscribe(tryReload);
      tryReload();
    };
    const open = () => openAppDb({ onBlocking, onTerminated: () => conn?.markLost() });
    boot({ bundle, clock: systemClock, openDb: open, extras })
      .then(({ db: opened, state: booted }) => {
        if (cancelled) return opened.close();
        conn = createConnection(opened, open);
        setDb(conn);
        store.dispatch({ type: 'booted', state: booted });
      })
      .catch((e: unknown) => {
        if (!cancelled) store.dispatch({ type: 'fatal', message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [store]);

  const actions = useMemo(
    () => (db ? createActions({ db, clock: systemClock, getState: store.getState, dispatch: store.dispatch, extras }) : undefined),
    [db, store],
  );

  return <AppContext.Provider value={{ state, actions }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
