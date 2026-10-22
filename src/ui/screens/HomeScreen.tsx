import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Actions } from '../../app/actions.ts';
import { poolsOf } from '../../app/round.ts';
import type { ReadyState } from '../../app/state.ts';
import { canPractice, todayCount } from '../../domain/session.ts';
import { isFirstRun } from '../../domain/reminders.ts';
import { applyUpdateOnHome } from '../../pwa/registerSW.ts';
import { isStandalone } from '../../pwa/standalone.ts';
import { BackupRestore } from '../components/BackupSection.tsx';
import { focusCard } from '../focusCard.ts';
import { t } from '../strings.tr.ts';

interface Props {
  state: ReadyState;
  actions: Actions;
}

/**
 * Home (05 §1): one number and one bottom button: "Başla · bugün N", "Devam et"
 * or none ("Bugün bitti. Yarın görüşürüz."). The only screen where a waiting
 * service worker update is applied (07 §6.2).
 * Slice 5 (T5.5): first-run welcome with "Yedekten geri yükle", the install
 * hint outside standalone mode and the weekly backup reminder: text only.
 */
export function HomeScreen({ state, actions }: Props) {
  const { session } = state;
  const pools = poolsOf(state, state.counter);
  const count = todayCount(pools, state.counter.day);

  useEffect(() => applyUpdateOnHome({ hasSession: session !== undefined }), [session]);
  useEffect(() => {
    void actions.refreshHome();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void actions.refreshHome();
    };
    document.addEventListener('visibilitychange', onVisibility);
    // Left open in the foreground over midnight: switch to the new day then (09 #7).
    // A timer delayed in the background is covered by visibilitychange above.
    let timer: ReturnType<typeof setTimeout>;
    const armMidnight = () => {
      timer = setTimeout(() => {
        void actions.refreshHome();
        armMidnight();
      }, actions.msUntilNextDay() + 1000);
    };
    armMidnight();
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [actions]);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []); // focus would otherwise stay on <body> (a11y audit 08 #8)

  const done = !session && count === 0;
  const practiceOffered = done && canPractice(pools, state.counter.day);
  const firstRun = isFirstRun({
    firstRunAt: state.meta.firstRunAt,
    progress: state.progress.size,
    notebook: state.notebook.length,
    imported: state.catalog.imported.length,
  });
  const [standalone] = useState(isStandalone);
  const showInstallHint = !standalone && state.meta.installHintDismissed !== true;
  const showBackupReminder = !firstRun && actions.isBackupReminderDue();

  function go(action: () => void) {
    flushSync(action);
    focusCard();
  }

  function start() {
    // The first "Başla" also asks for persistent storage, inside this tap (T5.5).
    actions.beginFirstRun();
    actions.startRound();
  }

  function practice() {
    actions.startPractice();
  }

  return (
    <div className="screen home">
      <div className="screen__body screen__body--center">
        {firstRun && (
          <div className="home-note home-note--welcome" data-testid="welcome">
            <p>{t.welcome}</p>
            <p className="muted">{t.welcomeRestore}</p>
            <BackupRestore actions={actions} busy={state.busy} buttonClass="btn btn--text" />
          </div>
        )}
        {showInstallHint && (
          <Note id="install-hint" text={t.installHint} onDismiss={() => void actions.dismissInstallHint()} />
        )}
        {showBackupReminder && (
          <Note id="backup-reminder" text={t.backupReminder} onDismiss={() => void actions.dismissBackupReminder()} />
        )}
        <h2 ref={headingRef} tabIndex={-1} className="done__title" data-testid="today-count">
          {count > 0 ? t.todayCount(count) : done ? t.todayDone : t.resume}
        </h2>
        {done && <p className="muted">{t.todayDoneDetail}</p>}
        {practiceOffered && <p className="muted">{t.practiceDetail}</p>}
        {session && <p className="muted">{t.resumeDetail}</p>}
      </div>
      <div className="screen__footer">
        {/* Notebook and Settings: text buttons, one tap away (07 §5.1). */}
        <div className="home__links">
          <button type="button" className="btn btn--text" onClick={() => flushSync(() => actions.openNotebook('home'))}>
            {t.notebookAdd}
          </button>
          <button type="button" className="btn btn--text" onClick={() => actions.openSettings()}>
            {t.settings}
          </button>
        </div>
        {done ? (
          practiceOffered ? (
            <button type="button" className="btn btn--primary" onClick={() => go(practice)} disabled={state.busy}>
              {t.practice}
            </button>
          ) : null
        ) : session ? (
          <button type="button" className="btn btn--primary" onClick={() => go(actions.resume)} disabled={state.busy}>
            {t.resume}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => go(start)} disabled={state.busy}>
            {t.start(count)}
          </button>
        )}
      </div>
    </div>
  );
}

/** A plain dismissible line on Home (install hint, backup reminder). No counts (05 §1). */
function Note({ id, text, onDismiss }: { id: string; text: string; onDismiss: () => void }) {
  return (
    <div className="home-note" data-testid={id}>
      <p id={`${id}-text`}>{text}</p>
      <button type="button" className="btn btn--text" aria-describedby={`${id}-text`} onClick={onDismiss}>
        {t.dismiss}
      </button>
    </div>
  );
}
