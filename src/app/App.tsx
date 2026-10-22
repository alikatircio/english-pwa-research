import '../ui/styles/global.css';
import { CardScreen } from '../ui/screens/CardScreen.tsx';
import { HomeScreen } from '../ui/screens/HomeScreen.tsx';
import { RoundEndScreen } from '../ui/screens/RoundEndScreen.tsx';
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
  if (state.screen === 'roundEnd') return <RoundEndScreen state={state} actions={actions} />;
  if (state.screen === 'card' && state.session) return <CardScreen state={state} actions={actions} />;
  return <HomeScreen state={state} actions={actions} />;
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
