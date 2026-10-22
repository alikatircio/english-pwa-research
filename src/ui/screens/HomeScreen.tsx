import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import type { Actions } from '../../app/actions.ts';
import { poolsOf } from '../../app/round.ts';
import type { ReadyState } from '../../app/state.ts';
import { todayCount } from '../../domain/session.ts';
import { applyUpdateOnHome } from '../../pwa/registerSW.ts';
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
 */
export function HomeScreen({ state, actions }: Props) {
  const { session } = state;
  const count = todayCount(poolsOf(state, state.counter), state.counter.day);

  useEffect(() => applyUpdateOnHome({ hasSession: session !== undefined }), [session]);
  useEffect(() => {
    void actions.refreshHome();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void actions.refreshHome();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [actions]);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []); // focus would otherwise stay on <body> (a11y audit 08 #8)

  const done = !session && count === 0;

  function go(action: () => void) {
    flushSync(action);
    focusCard();
  }

  return (
    <div className="screen home">
      <div className="screen__body screen__body--center">
        <h2 ref={headingRef} tabIndex={-1} className="done__title" data-testid="today-count">
          {count > 0 ? t.todayCount(count) : done ? t.todayDone : t.resume}
        </h2>
        {done && <p className="muted">{t.todayDoneDetail}</p>}
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
        {done ? null : session ? (
          <button type="button" className="btn btn--primary" onClick={() => go(actions.resume)} disabled={state.busy}>
            {t.resume}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => go(actions.startRound)} disabled={state.busy}>
            {t.start(count)}
          </button>
        )}
      </div>
    </div>
  );
}
