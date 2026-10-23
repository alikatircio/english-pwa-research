import '../ui/styles/global.css';
import { NotebookSheet } from '../ui/components/NotebookSheet.tsx';
import { NoticeBar } from '../ui/components/NoticeBar.tsx';
import { CardScreen } from '../ui/screens/CardScreen.tsx';
import { HomeScreen } from '../ui/screens/HomeScreen.tsx';
import { RoundEndScreen } from '../ui/screens/RoundEndScreen.tsx';
import { SettingsScreen } from '../ui/screens/SettingsScreen.tsx';
import { t } from '../ui/strings.tr.ts';
import { useState } from 'react';
import { DiagnosticResultScreen } from '../ui/screens/DiagnosticResultScreen.tsx';
import { DiagnosticScreen } from '../ui/screens/DiagnosticScreen.tsx';
import type { Actions } from './actions.ts';
import { AppProvider, useApp } from './AppContext.tsx';
import type { DiagnosticView } from './mode.ts';
import type { ReadyState } from './state.ts';

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
  return (
    <>
      <ScreenOrOverlay state={state} actions={actions} />
      <NoticeBar notice={state.notice} onDismiss={actions.dismissNotice} />
    </>
  );
}

function ScreenOrOverlay({ state, actions }: { state: ReadyState; actions: Actions }) {
  const [diagView, setDiagView] = useState<DiagnosticView | undefined>();
  // The overlay replaces the screen view; the screen's state lives in the store, so it comes back unchanged.
  if (state.overlay?.kind === 'notebook') return <NotebookSheet state={state} actions={actions} />;
  if (state.screen === 'settings' && diagView?.kind === 'test') return <DiagnosticScreen state={state} actions={actions} onView={setDiagView} />;
  if (state.screen === 'settings' && diagView && diagView.kind !== 'test') return <DiagnosticResultScreen state={state} view={diagView} onView={setDiagView} />;
  if (state.screen === 'settings') return <SettingsScreen state={state} actions={actions} onDiagnostic={setDiagView} />;
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
