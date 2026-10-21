import { t } from '../ui/strings.tr.ts';
import { AppProvider, useApp } from './AppContext.tsx';

function Screen() {
  const { state } = useApp();
  if (state.status === 'loading') return <p>{t.loading}</p>;
  if (state.status === 'fatal') return <p role="alert">{t.bootFailed}</p>;
  const entry = state.session?.queue[state.session.cursor];
  const item = entry ? state.catalog.byId.get(entry.itemId) : undefined;
  return <p>{item ? item.situationTr : t.allDone}</p>;
}

export function App() {
  return (
    <AppProvider>
      <main>
        <h1>{t.appTitle}</h1>
        <Screen />
      </main>
    </AppProvider>
  );
}
