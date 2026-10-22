import '../ui/styles/global.css';
import { CardScreen } from '../ui/screens/CardScreen.tsx';
import { DoneScreen } from '../ui/screens/DoneScreen.tsx';
import { t } from '../ui/strings.tr.ts';
import { AppProvider, useApp } from './AppContext.tsx';

function CurrentScreen() {
  const { state, actions } = useApp();
  if (state.status === 'fatal') {
    return (
      <div className="screen">
        <div className="screen__body screen__body--center">
          <p role="alert">{t.bootFailed}</p>
        </div>
      </div>
    );
  }
  if (state.status === 'loading' || !actions) {
    return (
      <div className="screen">
        <div className="screen__body screen__body--center">
          <p className="muted" role="status">
            {t.loading}
          </p>
        </div>
      </div>
    );
  }
  if (state.screen === 'done' || !state.session) return <DoneScreen />;
  return <CardScreen state={state} actions={actions} />;
}

export function App() {
  return (
    <AppProvider>
      <main>
        <h1 className="visually-hidden">{t.appTitle}</h1>
        <CurrentScreen />
      </main>
    </AppProvider>
  );
}
